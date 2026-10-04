"use client";

import { useCallback, useEffect, useRef } from "react";

const SAVE_DEBOUNCE_MS = 1500;

export function useProgressSync(bookId: string) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef<{ location: string; percent: number } | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (latestRef.current) {
        const { location, percent } = latestRef.current;
        fetch(`/api/books/${bookId}/progress`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ location, percent }),
          keepalive: true,
        }).catch(() => {});
      }
    };
  }, [bookId]);

  return useCallback(
    (next: { location: string; percent: number }) => {
      latestRef.current = next;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        fetch(`/api/books/${bookId}/progress`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(next),
        }).catch(() => {});
      }, SAVE_DEBOUNCE_MS);
    },
    [bookId]
  );
}
