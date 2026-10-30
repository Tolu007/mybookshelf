"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { sendOrQueue } from "@/lib/offline-queue";
import { isPlausiblePage } from "@/lib/reading-speed";

const MIN_SESSION_SECONDS = 30;

export type SessionState = "running" | "paused" | "stopped";
// Why a session is paused. Hiding the tab also stops the clock, but that
// isn't a pause: it resumes by itself when you come back. "idle" pauses
// resume on the next page turn; "break" is a Pomodoro break.
export type PauseReason = "manual" | "idle" | "break";

export type ReadingSession = {
  elapsedSeconds: number;
  state: SessionState;
  reason: PauseReason | null;
  // Seconds saved by sessions already stopped during this visit.
  savedSeconds: number;
  // Length of the last stopped session, for the "saved" message.
  lastSessionSeconds: number | null;
  pause: (reason?: PauseReason) => void;
  resume: () => void;
  stop: () => void;
  start: () => void;
  // Call on activity other than page turns (e.g. typing a note): keeps
  // auto-pause from firing, and resumes an idle pause.
  markActivity: () => void;
  // Call on every page turn with the new page's word count (null if not
  // known yet). Forward turns add the page you left to the speed sample.
  pageTurn: (words: number | null, forward: boolean) => void;
  // Fills in the current page's word count once it's known.
  notePageWords: (words: number) => void;
  // Words measured this session and the reading time spent on them.
  speedSample: { words: number; seconds: number };
};

export function useReadingSession(
  bookId: string,
  { autoPauseMinutes = null }: { autoPauseMinutes?: number | null } = {}
): ReadingSession {
  const accumulatedMsRef = useRef(0);
  const segmentStartRef = useRef<number | null>(null);
  const startedAtRef = useRef(new Date().toISOString());
  const reasonRef = useRef<PauseReason | null>(null);
  const stoppedRef = useRef(false);
  const lastActivityRef = useRef(0);
  const autoPauseMsRef = useRef(autoPauseMinutes ? autoPauseMinutes * 60_000 : null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [status, setStatus] = useState<{ state: SessionState; reason: PauseReason | null }>({ state: "running", reason: null });
  const [savedSeconds, setSavedSeconds] = useState(0);
  const [lastSessionSeconds, setLastSessionSeconds] = useState<number | null>(null);
  // The page on screen: its words, and the session clock when it appeared.
  const pageRef = useRef<{ words: number | null; enteredAt: number } | null>(null);
  const sampleRef = useRef({ words: 0, seconds: 0 });
  const [speedSample, setSpeedSample] = useState({ words: 0, seconds: 0 });

  const halt = useCallback(() => {
    if (segmentStartRef.current !== null) {
      accumulatedMsRef.current += Date.now() - segmentStartRef.current;
      segmentStartRef.current = null;
    }
  }, []);

  // Only counts while the session is live, not paused, and the page is in
  // front of the reader.
  const run = useCallback(() => {
    if (
      segmentStartRef.current === null &&
      !stoppedRef.current &&
      reasonRef.current === null &&
      document.visibilityState === "visible"
    ) {
      segmentStartRef.current = Date.now();
      // Coming back to the page counts as activity for auto-pause.
      lastActivityRef.current = Date.now();
    }
  }, []);

  const elapsedNow = useCallback(() => {
    const active = segmentStartRef.current ? Date.now() - segmentStartRef.current : 0;
    return Math.floor((accumulatedMsRef.current + active) / 1000);
  }, []);

  // Saves the current session (if long enough) and resets the clock.
  const save = useCallback(() => {
    halt();
    const durationSeconds = Math.floor(accumulatedMsRef.current / 1000);
    const sample = sampleRef.current;
    accumulatedMsRef.current = 0;
    sampleRef.current = { words: 0, seconds: 0 };
    // The next session's clock starts at zero, so the page on screen does too.
    if (pageRef.current) pageRef.current = { ...pageRef.current, enteredAt: 0 };
    if (durationSeconds < MIN_SESSION_SECONDS) return 0;
    sendOrQueue(`/api/books/${bookId}/sessions`, "POST", {
      startedAt: startedAtRef.current,
      endedAt: new Date().toISOString(),
      durationSeconds,
      localDate: format(new Date(), "yyyy-MM-dd"),
      wordsRead: sample.words,
      wordSeconds: Math.round(sample.seconds),
    });
    return durationSeconds;
  }, [bookId, halt]);

  const pause = useCallback((reason: PauseReason = "manual") => {
    if (stoppedRef.current) return;
    halt();
    reasonRef.current = reason;
    setElapsedSeconds(elapsedNow());
    setStatus({ state: "paused", reason });
  }, [halt, elapsedNow]);

  const resume = useCallback(() => {
    if (stoppedRef.current) return;
    reasonRef.current = null;
    lastActivityRef.current = Date.now();
    run();
    setStatus({ state: "running", reason: null });
  }, [run]);

  const stop = useCallback(() => {
    if (stoppedRef.current) return;
    const saved = save();
    stoppedRef.current = true;
    reasonRef.current = null;
    setSavedSeconds((value) => value + saved);
    setLastSessionSeconds(saved);
    setElapsedSeconds(0);
    setSpeedSample({ words: 0, seconds: 0 });
    setStatus({ state: "stopped", reason: null });
  }, [save]);

  const start = useCallback(() => {
    if (!stoppedRef.current) return;
    stoppedRef.current = false;
    reasonRef.current = null;
    accumulatedMsRef.current = 0;
    startedAtRef.current = new Date().toISOString();
    lastActivityRef.current = Date.now();
    run();
    setLastSessionSeconds(null);
    setStatus({ state: "running", reason: null });
  }, [run]);

  const markActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (reasonRef.current === "idle") resume();
  }, [resume]);

  const pageTurn = useCallback((words: number | null, forward: boolean) => {
    const now = elapsedNow();
    const previous = pageRef.current;
    if (previous && forward && previous.words !== null && isPlausiblePage(previous.words, now - previous.enteredAt)) {
      sampleRef.current = {
        words: sampleRef.current.words + previous.words,
        seconds: sampleRef.current.seconds + (now - previous.enteredAt),
      };
      setSpeedSample(sampleRef.current);
    }
    pageRef.current = { words, enteredAt: now };
    markActivity();
  }, [elapsedNow, markActivity]);

  const notePageWords = useCallback((words: number) => {
    if (pageRef.current && pageRef.current.words === null) {
      pageRef.current = { ...pageRef.current, words };
    }
  }, []);

  useEffect(() => {
    autoPauseMsRef.current = autoPauseMinutes ? autoPauseMinutes * 60_000 : null;
  }, [autoPauseMinutes]);

  useEffect(() => {
    // A fresh session per book (and per remount in development).
    stoppedRef.current = false;
    reasonRef.current = null;
    accumulatedMsRef.current = 0;
    segmentStartRef.current = null;
    startedAtRef.current = new Date().toISOString();
    lastActivityRef.current = Date.now();
    pageRef.current = null;
    sampleRef.current = { words: 0, seconds: 0 };
    run();

    function onVisibilityChange() {
      if (document.visibilityState === "hidden") halt();
      else run();
    }

    // Clicking into the EPUB page moves focus into its iframe, which also
    // blurs the window, so only stop the clock if focus really left the page.
    function onBlur() {
      setTimeout(() => {
        if (!document.hasFocus()) halt();
      }, 0);
    }

    function finalize() {
      if (stoppedRef.current) return;
      stoppedRef.current = true;
      save();
    }

    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", run);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", finalize);

    const tick = setInterval(() => {
      const idleLimit = autoPauseMsRef.current;
      if (idleLimit && segmentStartRef.current !== null && Date.now() - lastActivityRef.current > idleLimit) {
        pause("idle");
        return;
      }
      setElapsedSeconds(elapsedNow());
    }, 1000);

    return () => {
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", run);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", finalize);
      clearInterval(tick);
      finalize();
    };
  }, [bookId, halt, run, save, elapsedNow, pause]);

  return {
    elapsedSeconds,
    state: status.state,
    reason: status.reason,
    savedSeconds,
    lastSessionSeconds,
    pause,
    resume,
    stop,
    start,
    markActivity,
    pageTurn,
    notePageWords,
    speedSample,
  };
}
