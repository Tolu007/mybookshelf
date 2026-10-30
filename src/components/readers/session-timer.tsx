"use client";

import { Pause, Play, RotateCcw, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ReadingSession } from "@/hooks/use-reading-session";
import { cn } from "@/lib/utils";

export function clock(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
}

const PAUSE_LABEL: Record<NonNullable<ReadingSession["reason"]>, string> = {
  manual: "Paused",
};

// The session clock in the reader bar, with pause/resume and stop.
export function SessionTimer({ session }: { session: ReadingSession }) {
  const { state, reason, elapsedSeconds, lastSessionSeconds } = session;

  if (state === "stopped") {
    const saved = lastSessionSeconds ?? 0;
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-background py-1 pr-1 pl-2.5 dark:bg-secondary">
        <span role="status" className="text-[11px] font-semibold text-muted-foreground">
          {saved > 0 ? `Session saved · ${Math.max(1, Math.round(saved / 60))}m` : "Session too short to save"}
        </span>
        <Button size="xs" onClick={session.start}>
          <RotateCcw /> New session
        </Button>
      </div>
    );
  }

  const running = state === "running";
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-background py-1 pr-1 pl-2.5 dark:bg-secondary">
      <span className={cn("size-1.5 rounded-full", running ? "animate-pulse bg-ribbon motion-reduce:animate-none" : "bg-muted-foreground")} aria-hidden="true" />
      <span className="text-[10px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
        {running ? "In focus" : PAUSE_LABEL[reason ?? "manual"]}
      </span>
      <time className={cn("font-mono text-xs font-semibold tabular-nums", !running && "text-muted-foreground")} aria-hidden="true">{clock(elapsedSeconds)}</time>
      <span className="sr-only">{Math.floor(elapsedSeconds / 60)}m this session</span>
      <span className="flex items-center">
        {running ? (
          <Button variant="ghost" size="icon-xs" aria-label="Pause session" title="Pause" onClick={() => session.pause()}><Pause /></Button>
        ) : (
          <Button variant="ghost" size="icon-xs" aria-label="Resume session" title="Resume" onClick={session.resume}><Play /></Button>
        )}
        <Button variant="ghost" size="icon-xs" aria-label="Stop and save session" title="Stop and save" onClick={session.stop}><Square /></Button>
      </span>
    </div>
  );
}
