"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { sendOrQueue } from "@/lib/offline-queue";

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
  // Call on every page turn: keeps auto-pause from firing, and resumes an
  // idle pause.
  markActivity: () => void;
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
    accumulatedMsRef.current = 0;
    if (durationSeconds < MIN_SESSION_SECONDS) return 0;
    sendOrQueue(`/api/books/${bookId}/sessions`, "POST", {
      startedAt: startedAtRef.current,
      endedAt: new Date().toISOString(),
      durationSeconds,
      localDate: format(new Date(), "yyyy-MM-dd"),
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
  };
}
