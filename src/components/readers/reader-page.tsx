"use client";

import type { CSSProperties, ReactNode } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

// The page itself: a sheet with the chapter above the text and page
// turning below it.
export function ReaderPage({
  eyebrow = null,
  caption = null,
  pageLabel = null,
  onPrev,
  onNext,
  canPrev = true,
  canNext = true,
  className,
  style,
  children,
}: {
  eyebrow?: string | null;
  // Small mono line at the bottom left, e.g. the author.
  caption?: string | null;
  pageLabel?: string | null;
  onPrev: () => void;
  onNext: () => void;
  canPrev?: boolean;
  canNext?: boolean;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const turnClass = "flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-semibold transition-colors hover:text-sage disabled:pointer-events-none disabled:opacity-40";
  return (
    <div className={cn("relative flex h-full min-h-0 w-full flex-col overflow-hidden rounded-2xl shadow-[var(--shadow-card)] ring-1 ring-border", className)} style={style}>
      {eyebrow && <p className="shrink-0 truncate px-6 pt-5 text-center text-[11px] font-bold tracking-[0.2em] text-amber uppercase sm:pt-7">{eyebrow}</p>}
      <div className="relative min-h-0 flex-1">{children}</div>
      <div className="mx-5 flex shrink-0 items-center justify-between gap-3 border-t border-current/10 py-2.5 opacity-80 sm:mx-12">
        <span className="truncate font-mono text-[10px] tracking-[0.18em] uppercase">{caption}</span>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" onClick={onPrev} disabled={!canPrev} className={turnClass} aria-label="Previous page">
            <ArrowLeft className="size-3.5" aria-hidden="true" /> <span className="hidden sm:inline">Prev page</span>
          </button>
          {pageLabel && <span className="text-[11px] font-bold tabular-nums">{pageLabel}</span>}
          <button type="button" onClick={onNext} disabled={!canNext} className={turnClass} aria-label="Next page">
            <span className="hidden sm:inline">Next page</span> <ArrowRight className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Light papers get the dotted "paper texture" from the design.
export function paperStyle(background: string, color: string, textured: boolean): CSSProperties {
  return textured
    ? {
        backgroundColor: background,
        color,
        backgroundImage: "radial-gradient(rgb(120 100 70 / 0.16) 0.65px, transparent 0.65px)",
        backgroundSize: "18px 18px",
      }
    : { backgroundColor: background, color };
}
