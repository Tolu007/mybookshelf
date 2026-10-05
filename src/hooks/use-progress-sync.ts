"use client";

import { useCallback, useEffect, useRef } from "react";
import { sendOrQueue } from "@/lib/offline-queue";

const SAVE_DEBOUNCE_MS = 1500;

export function useProgressSync(bookId: string) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef<{ location: string; percent: number } | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (latestRef.current) {
        sendOrQueue(`/api/books/${bookId}/progress`, "PUT", latestRef.current, { dedupe: true });
      }
    };
  }, [bookId]);

  return useCallback(
    (next: { location: string; percent: number }) => {
      latestRef.current = next;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        sendOrQueue(`/api/books/${bookId}/progress`, "PUT", next, { dedupe: true });
      }, SAVE_DEBOUNCE_MS);
    },
    [bookId]
  );
}
