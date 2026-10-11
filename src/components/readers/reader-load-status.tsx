"use client";

import Link from "next/link";
import { BookOpen, CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ReaderLoadState } from "@/lib/book-download";

function formatBytes(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ReaderLoadStatus({ state, onRetry }: { state: ReaderLoadState; onRetry: () => void }) {
  if (state.phase === "ready") return null;
  const error = state.phase === "error";
  const percent = state.phase === "downloading" && state.total !== null
    ? Math.min(100, Math.floor((state.loaded / state.total) * 100))
    : state.phase === "opening" ? 100 : undefined;

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-background/95 p-6">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-6 shadow-sm" role={error ? "alert" : "status"}>
        {error ? <CircleAlert className="mb-4 size-7 text-destructive" /> : <BookOpen className="mb-4 size-7 text-primary" />}
        <h2 className="text-lg font-semibold">{error ? "Couldn't open your book" : state.phase === "opening" ? "Preparing your book" : "Downloading your book"}</h2>
        {error ? (
          <>
            <p className="mt-2 text-sm text-muted-foreground">{state.message}</p>
            <div className="mt-5 flex flex-wrap items-center gap-4">
              <Button onClick={onRetry}>Try again</Button>
              <Link href="/" className="text-sm underline underline-offset-4">Back to library</Link>
            </div>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm text-muted-foreground">
              {state.phase === "opening" ? "Download complete. Opening the first page…" : "Your book will open as soon as it's ready."}
            </p>
            <div
              role="progressbar"
              aria-label="Book download progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              className="mt-5 h-2 overflow-hidden rounded-full bg-muted"
            >
              <div className={percent === undefined ? "h-full w-1/3 animate-pulse rounded-full bg-primary" : "h-full rounded-full bg-primary transition-[width]"} style={percent === undefined ? undefined : { width: `${percent}%` }} />
            </div>
            <p className="mt-2 text-xs text-muted-foreground tabular-nums">
              {state.phase === "opening" ? "100% downloaded" : `${percent === undefined ? "Downloading" : `${percent}%`} · ${formatBytes(state.loaded)}${state.total === null ? " received" : ` of ${formatBytes(state.total)}`}`}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
