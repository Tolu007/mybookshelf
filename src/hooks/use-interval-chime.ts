"use client";

import { useEffect, useRef } from "react";
import { playChime } from "@/lib/chime";

// Chimes each time the session's reading time passes another interval
// (15, 30, 45… minutes). Paused time doesn't count, and a new session
// starts counting from zero again.
export function useIntervalChime(elapsedSeconds: number, intervalMinutes: number | null) {
  const lastIntervalRef = useRef(0);

  useEffect(() => {
    if (!intervalMinutes) return;
    const interval = Math.floor(elapsedSeconds / (intervalMinutes * 60));
    if (interval > lastIntervalRef.current) playChime();
    // Also resets when a new session restarts the clock at zero.
    lastIntervalRef.current = interval;
  }, [elapsedSeconds, intervalMinutes]);
}
