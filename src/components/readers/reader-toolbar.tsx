"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { ArrowLeft, Check, ChevronDown, ChevronUp, Flag, Hourglass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SessionTimer } from "@/components/readers/session-timer";
import type { ReadingSession } from "@/hooks/use-reading-session";
import type { PomodoroView } from "@/hooks/use-pomodoro";
import { cn } from "@/lib/utils";

// The floating bar above the page: session and goal on the left, where you
// are in the book in the middle, reading tools on the right.
export function ReaderToolbar({
  title,
  format,
  chapterLabel = null,
  progressLabel = null,
  session,
  pomodoro = null,
  isFinished,
  onMarkFinished,
  dailyGoalMinutes = null,
  minutesBeforeSession = 0,
  children,
  trailing = null,
}: {
  title: string;
  format?: string;
  chapterLabel?: string | null;
  // e.g. "28% (p. 142/502)".
  progressLabel?: string | null;
  session: ReadingSession;
  pomodoro?: PomodoroView | null;
  isFinished: boolean;
  onMarkFinished: () => void;
  // Today's goal from Settings, and what was already read today before
  // the reader opened.
  dailyGoalMinutes?: number | null;
  minutesBeforeSession?: number;
  children?: ReactNode;
  // After the finish button, at the far right (the notes toggle).
  trailing?: ReactNode;
}) {
  const todayMinutes = Math.floor(minutesBeforeSession + (session.savedSeconds + session.elapsedSeconds) / 60);
  const goalPercent = dailyGoalMinutes ? Math.min(100, (todayMinutes / dailyGoalMinutes) * 100) : 0;

  return (
    <header className="z-20 mx-3 mt-3 flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border border-border bg-popover/95 px-2.5 py-2 shadow-[var(--shadow-card)] backdrop-blur-md sm:mx-6 sm:mt-4 sm:px-3">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <Link href="/" aria-label="Back to your library" title="Back to your library" className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
          <ArrowLeft className="size-4" />
        </Link>
        <SessionTimer session={session} pomodoro={pomodoro} />
        {dailyGoalMinutes && (
          <div className="hidden items-center gap-2 pl-1 text-muted-foreground lg:flex" title="Today's reading goal">
            <Flag className="size-3.5 text-sage" aria-hidden="true" />
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <span className="font-medium">Daily goal</span>
                <span className="font-bold text-foreground tabular-nums">{todayMinutes} / {dailyGoalMinutes}m</span>
              </div>
              <div role="progressbar" aria-label="Today's reading goal" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(goalPercent)} className="h-1.5 w-24 overflow-hidden rounded-full bg-secondary">
                <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${goalPercent}%` }} />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="order-last flex w-full min-w-0 items-center justify-center gap-2 text-center lg:order-none lg:w-auto lg:flex-1">
        <h1 className="truncate font-heading text-lg leading-6 font-semibold text-sage">{title}</h1>
        {chapterLabel && (
          <>
            <span className="text-border" aria-hidden="true">•</span>
            <span className="hidden max-w-56 truncate text-sm font-semibold text-muted-foreground sm:inline">{chapterLabel}</span>
          </>
        )}
        {progressLabel && <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-muted-foreground tabular-nums">{progressLabel}</span>}
        {format && <span className="sr-only">{format} book</span>}
      </div>

      <div role="group" aria-label="Reading controls" className="flex items-center gap-1">
        {children}
        <Button variant={isFinished ? "secondary" : "outline"} size="sm" onClick={onMarkFinished} disabled={isFinished} className="ml-1">
          <Check />
          <span className="hidden xl:inline">{isFinished ? "Finished" : "Finish book"}</span>
          <span className="xl:hidden">{isFinished ? "Done" : "Finish"}</span>
        </Button>
        {trailing}
      </div>
    </header>
  );
}

const SCRUBBER_STORAGE_KEY = "shelf-reader-progress";

// Remembers (per device) whether the progress bar was collapsed.
function useCollapsedScrubber() {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      // localStorage is only readable after mount.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCollapsed(localStorage.getItem(SCRUBBER_STORAGE_KEY) === "collapsed");
    } catch {
      // Storage unavailable: start expanded.
    }
  }, []);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(SCRUBBER_STORAGE_KEY, next ? "collapsed" : "expanded");
    } catch {
      // Still collapses for this visit.
    }
  }

  return [collapsed, toggle] as const;
}

// The position line along the bottom: progress, chapter markers, and the
// reading-speed estimate. Clicking the line jumps there. It collapses to a
// slim progress line.
export function ReaderScrubber({
  percent,
  markers = [],
  onSeek,
  timeLeft = null,
  speed = null,
  chapter = null,
  position,
}: {
  percent: number;
  markers?: { label: string; percent: number }[];
  onSeek?: (fraction: number) => void;
  timeLeft?: string | null;
  speed?: string | null;
  // e.g. "4 of 12".
  chapter?: string | null;
  // e.g. "Page 142 of 502".
  position: string;
}) {
  const clamped = Math.min(100, Math.max(0, percent));
  const [collapsed, toggleCollapsed] = useCollapsedScrubber();

  function seekTo(clientX: number, target: HTMLElement) {
    if (!onSeek) return;
    const rect = target.getBoundingClientRect();
    onSeek(Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)));
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (!onSeek) return;
    const step = event.shiftKey ? 10 : 1;
    if (event.key === "ArrowRight") onSeek(Math.min(100, clamped + step) / 100);
    else if (event.key === "ArrowLeft") onSeek(Math.max(0, clamped - step) / 100);
    else return;
    event.preventDefault();
  }

  if (collapsed) {
    return (
      <footer className="flex shrink-0 items-center gap-3 border-t border-border bg-popover/90 py-1 pr-2 pl-4 backdrop-blur-md sm:pl-6">
        <div role="progressbar" aria-label="Book position" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(clamped)} aria-valuetext={`${Math.round(clamped)}% · ${position}`} className="h-1 flex-1 overflow-hidden rounded-full bg-secondary">
          <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${clamped}%` }} />
        </div>
        <span className="shrink-0 text-[11px] font-semibold text-muted-foreground tabular-nums">{Math.round(clamped)}%</span>
        <Button variant="ghost" size="icon-xs" aria-label="Show reading progress" aria-expanded={false} title="Show reading progress" onClick={toggleCollapsed} className="text-muted-foreground">
          <ChevronUp />
        </Button>
      </footer>
    );
  }

  return (
    <footer className="shrink-0 space-y-1.5 border-t border-border bg-popover/90 px-4 pt-2.5 pb-2 backdrop-blur-md sm:px-6">
      <div
        role="slider"
        tabIndex={onSeek ? 0 : -1}
        aria-label="Book position"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(clamped)}
        aria-valuetext={`${Math.round(clamped)}% · ${position}`}
        onClick={(event) => seekTo(event.clientX, event.currentTarget)}
        onKeyDown={onKeyDown}
        className={cn("relative flex h-3 items-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-primary/25", onSeek && "cursor-pointer")}
      >
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
          <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${clamped}%` }} />
        </div>
        {markers.map((marker) => (
          <span key={`${marker.label}-${marker.percent}`} title={marker.label} className="absolute top-0 h-3 w-1 -translate-x-1/2 rounded-sm bg-muted-foreground/40" style={{ left: `${marker.percent}%` }} />
        ))}
        <span className="absolute top-0 size-3 -translate-x-1/2 rounded-full bg-ribbon shadow-sm ring-2 ring-popover" style={{ left: `${clamped}%` }} aria-hidden="true" />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <div className="flex min-w-0 items-center gap-3">
          {timeLeft && (
            <span className="flex items-center gap-1 font-semibold text-sage">
              <Hourglass className="size-3" aria-hidden="true" /> {timeLeft}
            </span>
          )}
          {timeLeft && speed && <span className="hidden sm:inline" aria-hidden="true">•</span>}
          {speed && <span className="hidden font-mono sm:inline">Reading cadence: {speed}</span>}
        </div>
        <div className="flex items-center gap-4">
          {chapter && <span>Chapter: <strong className="text-foreground">{chapter}</strong></span>}
          <span className="font-bold text-foreground tabular-nums">{position}</span>
          <Button variant="ghost" size="icon-xs" aria-label="Hide reading progress" aria-expanded={true} title="Hide reading progress" onClick={toggleCollapsed} className="-mr-2 text-muted-foreground">
            <ChevronDown />
          </Button>
        </div>
      </div>
    </footer>
  );
}
