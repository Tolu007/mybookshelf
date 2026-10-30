"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, Check, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SessionTimer } from "@/components/readers/session-timer";
import type { ReadingSession } from "@/hooks/use-reading-session";

export function ReaderToolbar({
  title,
  format,
  session,
  isFinished,
  onMarkFinished,
  dailyGoalMinutes = null,
  minutesBeforeSession = 0,
  children,
}: {
  title: string;
  format?: string;
  session: ReadingSession;
  isFinished: boolean;
  onMarkFinished: () => void;
  // Today's goal from Settings, and what was already read today before
  // the reader opened.
  dailyGoalMinutes?: number | null;
  minutesBeforeSession?: number;
  children?: ReactNode;
}) {
  const todayMinutes = Math.floor(minutesBeforeSession + (session.savedSeconds + session.elapsedSeconds) / 60);
  const goalPercent = dailyGoalMinutes ? Math.min(100, (todayMinutes / dailyGoalMinutes) * 100) : 0;

  return (
    <header className="z-10 shrink-0 border-b border-border bg-card/95 px-3 py-2.5 backdrop-blur sm:px-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Link href="/" aria-label="Back to your library" className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground dark:bg-secondary">
            <ArrowLeft className="size-4" />
          </Link>
          <div className="min-w-0">
            <p className="eyebrow hidden sm:block">{format ? `${format} · ` : ""}Active reader</p>
            <h1 className="truncate font-heading text-base leading-6 font-semibold sm:text-lg">{title}</h1>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:gap-3">
          <SessionTimer session={session} />

          {dailyGoalMinutes && (
            <div className="hidden items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5 md:flex dark:bg-secondary" title="Today's reading goal">
              <Flag className="size-3.5 text-amber" aria-hidden="true" />
              <div className="w-20">
                <div role="progressbar" aria-label="Today's reading goal" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(goalPercent)} className="h-1 overflow-hidden rounded-full bg-secondary dark:bg-background">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${goalPercent}%` }} />
                </div>
              </div>
              <span className="text-[11px] font-semibold tabular-nums">{todayMinutes}/{dailyGoalMinutes}m</span>
            </div>
          )}

          <Button variant={isFinished ? "secondary" : "default"} size="sm" onClick={onMarkFinished} disabled={isFinished}>
            <Check /> {isFinished ? "Finished" : "Finish book"}
          </Button>
        </div>
      </div>
      <div role="group" aria-label="Reading controls" className="mt-2.5 flex items-center gap-1 overflow-x-auto border-t border-border/70 pt-2.5 sm:justify-center [&>*]:shrink-0">{children}</div>
    </header>
  );
}

// The amber ribbon along the bottom of the reader.
export function ReaderProgress({ percent, label }: { percent: number; label: string }) {
  const clamped = Math.min(100, Math.max(0, percent));
  return (
    <footer className="flex shrink-0 items-center gap-3 border-t border-border bg-card/95 px-4 py-2 sm:px-6">
      <div role="progressbar" aria-label="Book progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(clamped)} className="h-1 flex-1 overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full bg-ribbon transition-[width] duration-300" style={{ width: `${clamped}%` }} />
      </div>
      <span className="meta shrink-0">{label}</span>
    </footer>
  );
}
