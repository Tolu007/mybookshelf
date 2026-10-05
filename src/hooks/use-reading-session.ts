"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { sendOrQueue } from "@/lib/offline-queue";

const MIN_SESSION_SECONDS = 30;

export function useReadingSession(bookId: string) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const accumulatedMsRef = { current: 0 };
    const segmentStartRef = { current: Date.now() as number | null };
    const finalizedRef = { current: false };
    const startedAt = new Date().toISOString();

    function pause() {
      if (segmentStartRef.current !== null) {
        accumulatedMsRef.current += Date.now() - segmentStartRef.current;
        segmentStartRef.current = null;
      }
    }

    function resume() {
      if (segmentStartRef.current === null && document.visibilityState === "visible") {
        segmentStartRef.current = Date.now();
      }
    }

    function onVisibilityChange() {
      if (document.visibilityState === "hidden") pause();
      else resume();
    }

    function finalize() {
      if (finalizedRef.current) return;
      finalizedRef.current = true;
      pause();

      const durationSeconds = Math.floor(accumulatedMsRef.current / 1000);
      if (durationSeconds < MIN_SESSION_SECONDS) return;

      sendOrQueue(`/api/books/${bookId}/sessions`, "POST", {
        startedAt,
        endedAt: new Date().toISOString(),
        durationSeconds,
        localDate: format(new Date(), "yyyy-MM-dd"),
      });
    }

    window.addEventListener("blur", pause);
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", finalize);

    const tick = setInterval(() => {
      const active = segmentStartRef.current ? Date.now() - segmentStartRef.current : 0;
      setElapsedSeconds(Math.floor((accumulatedMsRef.current + active) / 1000));
    }, 1000);

    return () => {
      window.removeEventListener("blur", pause);
      window.removeEventListener("focus", resume);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", finalize);
      clearInterval(tick);
      finalize();
    };
  }, [bookId]);

  return { elapsedSeconds };
}
