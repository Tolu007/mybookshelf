"use client";

import { useEffect, useRef, useState } from "react";
import type { ReadingSession } from "@/hooks/use-reading-session";
import { playChime } from "@/lib/chime";

export type PomodoroPhase = "focus" | "break" | "break_over";

export type PomodoroView = {
  phase: PomodoroPhase;
  // Focus or break time remaining; 0 once the break is over.
  secondsLeft: number;
  // Completed focus blocks this visit.
  cycles: number;
};

// Focus blocks measured in reading time (pauses don't eat into them),
// then a break measured in wall-clock time with the session paused. The
// next block starts when you resume reading.
export function usePomodoro(
  session: ReadingSession,
  { enabled, focusMinutes, breakMinutes }: { enabled: boolean; focusMinutes: number; breakMinutes: number }
): PomodoroView | null {
  const sessionRef = useRef(session);
  const phaseRef = useRef<PomodoroPhase>("focus");
  const focusStartRef = useRef(0);
  const breakEndsAtRef = useRef(0);
  const cyclesRef = useRef(0);
  const [view, setView] = useState<PomodoroView>({ phase: "focus", secondsLeft: focusMinutes * 60, cycles: 0 });

  useEffect(() => {
    sessionRef.current = session;
  });

  useEffect(() => {
    if (!enabled) return;
    const focusSeconds = focusMinutes * 60;
    const breakMs = breakMinutes * 60_000;

    function step() {
      const { state, elapsedSeconds, pause } = sessionRef.current;
      const now = Date.now();

      // A stopped (or freshly started) session counts from zero again.
      if (state === "stopped" || elapsedSeconds < focusStartRef.current) {
        focusStartRef.current = 0;
      }

      if (phaseRef.current === "focus") {
        if (state === "running" && elapsedSeconds - focusStartRef.current >= focusSeconds) {
          playChime();
          pause("break");
          cyclesRef.current += 1;
          phaseRef.current = "break";
          breakEndsAtRef.current = now + breakMs;
        }
      } else if (state === "running") {
        // Resumed (during or after the break): start the next focus block.
        phaseRef.current = "focus";
        focusStartRef.current = elapsedSeconds;
      } else if (phaseRef.current === "break" && now >= breakEndsAtRef.current) {
        playChime();
        phaseRef.current = "break_over";
      }

      const secondsLeft =
        phaseRef.current === "focus"
          ? Math.max(0, focusSeconds - (elapsedSeconds - focusStartRef.current))
          : phaseRef.current === "break"
            ? Math.max(0, Math.ceil((breakEndsAtRef.current - now) / 1000))
            : 0;
      setView({ phase: phaseRef.current, secondsLeft, cycles: cyclesRef.current });
    }

    const interval = setInterval(step, 1000);
    return () => clearInterval(interval);
  }, [enabled, focusMinutes, breakMinutes]);

  return enabled ? view : null;
}
