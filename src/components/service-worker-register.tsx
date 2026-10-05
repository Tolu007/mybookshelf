"use client";

import { useEffect } from "react";
import { flushOfflineQueue } from "@/lib/offline-queue";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    flushOfflineQueue();
    window.addEventListener("online", flushOfflineQueue);
    return () => window.removeEventListener("online", flushOfflineQueue);
  }, []);

  return null;
}
