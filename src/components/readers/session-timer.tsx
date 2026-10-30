"use client";

import { CircleStop, Pause, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ReadingSession } from "@/hooks/use-reading-session";
import type { PomodoroView } from "@/hooks/use-pomodoro";
import { cn } from "@/lib/utils";

export function clock(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
}

const PAUSE_LABEL: Record<NonNullable<ReadingSession["reason"]>, string> = {
  manual: "Paused",
  idle: "Paused · idle",
  break: "On a break",
};

function countdown(totalSeconds: number) {
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

function PomodoroBadge({ pomodoro }: { pomodoro: PomodoroView }) {
  const label =
    pomodoro.phase === "focus"
      ? `Focus ${countdown(pomodoro.secondsLeft)}`
      : pomodoro.phase === "break"
        ? `Break ${countdown(pomodoro.secondsLeft)}`
        : "Break over";
  return (
    <span
      title={`${pomodoro.cycles} focus ${pomodoro.cycles === 1 ? "block" : "blocks"} done`}
      className={cn(
        "rounded-sm px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
        pomodoro.phase === "focus" ? "bg-accent text-sage" : "bg-ribbon text-ribbon-foreground"
      )}
    >
      {label}
    </span>
  );
}

// The session clock in the reader bar, with pause/resume and stop.
export function SessionTimer({ session, pomodoro = null }: { session: ReadingSession; pomodoro?: PomodoroView | null }) {
  const { state, reason, elapsedSeconds, lastSessionSeconds } = session;

  if (state === "stopped") {
    const saved = lastSessionSeconds ?? 0;
    return (
      <div className="flex items-center gap-2 rounded-full bg-secondary py-1 pr-1 pl-3">
        <span role="status" className="text-[11px] font-semibold text-muted-foreground">
          {saved > 0 ? `Session saved · ${Math.max(1, Math.round(saved / 60))}m` : "Session too short to save"}
        </span>
        <Button size="xs" onClick={session.start} className="rounded-full">
          <RotateCcw /> New session
        </Button>
      </div>
    );
  }

  const running = state === "running";
  return (
    <div className="flex items-center gap-1">
      <div className="flex items-center gap-2 rounded-full bg-secondary px-3 py-1">
        <span className={cn("size-2.5 rounded-full", running ? "animate-pulse bg-ribbon motion-reduce:animate-none" : "bg-muted-foreground")} aria-hidden="true" />
        <span className={cn("text-[11px] font-semibold tracking-[0.06em] uppercase", running ? "text-amber" : "text-muted-foreground")}>
          {running ? "In focus" : PAUSE_LABEL[reason ?? "manual"]}
        </span>
        <time className={cn("font-mono text-sm font-semibold tracking-tight tabular-nums", !running && "text-muted-foreground")} aria-hidden="true">{clock(elapsedSeconds)}</time>
        <span className="sr-only">{Math.floor(elapsedSeconds / 60)}m this session</span>
        {pomodoro && <PomodoroBadge pomodoro={pomodoro} />}
      </div>
      {running ? (
        <Button variant="ghost" size="icon-sm" aria-label="Pause session" title="Pause" onClick={() => session.pause()} className="text-muted-foreground hover:text-sage"><Pause /></Button>
      ) : (
        <Button variant="ghost" size="icon-sm" aria-label={reason === "break" ? "End break and resume" : "Resume session"} title="Resume" onClick={session.resume} className="text-muted-foreground hover:text-sage"><Play /></Button>
      )}
      <Button variant="ghost" size="icon-sm" aria-label="Stop and save session" title="Stop and save" onClick={session.stop} className="text-muted-foreground hover:text-amber"><CircleStop /></Button>
    </div>
  );
}
