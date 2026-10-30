"use client";

import { useState } from "react";
import { Star, StarHalf } from "lucide-react";
import { RATING_MAX, RATING_STEP, formatRating } from "@/lib/rating";
import { cn } from "@/lib/utils";

function StarGlyph({ fill, className }: { fill: "full" | "half" | "empty"; className?: string }) {
  return (
    <span className={cn("relative inline-flex", className)}>
      <Star className={cn("size-full", fill === "full" ? "fill-amber text-amber" : "text-muted-foreground/45")} strokeWidth={1.6} />
      {fill === "half" && <StarHalf className="absolute inset-0 size-full fill-amber text-amber" strokeWidth={1.6} />}
    </span>
  );
}

function fillFor(rating: number, star: number) {
  if (rating >= star) return "full";
  if (rating >= star - RATING_STEP) return "half";
  return "empty";
}

// Read-only stars, e.g. on cards.
export function StarRating({ rating, className, starClassName = "size-3", showValue = false }: {
  rating: number;
  className?: string;
  starClassName?: string;
  showValue?: boolean;
}) {
  return (
    <span role="img" aria-label={`Rated ${formatRating(rating)} out of ${RATING_MAX}`} className={cn("inline-flex items-center gap-0.5", className)}>
      {Array.from({ length: RATING_MAX }, (_, index) => (
        <StarGlyph key={index} fill={fillFor(rating, index + 1)} className={starClassName} />
      ))}
      {showValue && <span className="ml-1 text-[11px] font-semibold text-muted-foreground tabular-nums" aria-hidden="true">{formatRating(rating)}</span>}
    </span>
  );
}

// Interactive stars. One tab stop: arrow keys move in half stars, Delete
// clears. Clicking the left half of a star gives a half star; clicking
// the current rating again clears it.
export function RatingInput({ value, onChange, label = "Your rating", disabled = false, starClassName = "size-6" }: {
  value: number | null;
  onChange: (value: number | null) => void;
  label?: string;
  disabled?: boolean;
  starClassName?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value ?? 0;

  function valueAt(event: React.PointerEvent | React.MouseEvent, star: number) {
    const rect = event.currentTarget.getBoundingClientRect();
    return event.clientX - rect.left < rect.width / 2 ? star - RATING_STEP : star;
  }

  function onKeyDown(event: React.KeyboardEvent) {
    const current = value ?? 0;
    let next: number | null | undefined;
    if (event.key === "ArrowRight" || event.key === "ArrowUp") next = Math.min(RATING_MAX, current + RATING_STEP);
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") next = current - RATING_STEP < RATING_STEP ? null : current - RATING_STEP;
    if (event.key === "Home") next = RATING_STEP;
    if (event.key === "End") next = RATING_MAX;
    if (event.key === "Delete" || event.key === "Backspace") next = null;
    if (next === undefined) return;
    event.preventDefault();
    onChange(next);
  }

  return (
    <div
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={RATING_MAX}
      aria-valuenow={value ?? 0}
      aria-valuetext={value ? `${formatRating(value)} out of ${RATING_MAX} stars` : "Not rated"}
      aria-disabled={disabled || undefined}
      onKeyDown={disabled ? undefined : onKeyDown}
      onPointerLeave={() => setHover(null)}
      className={cn("inline-flex items-center gap-0.5 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-primary/25", disabled && "pointer-events-none opacity-60")}
    >
      {Array.from({ length: RATING_MAX }, (_, index) => {
        const star = index + 1;
        return (
          <span
            key={star}
            aria-hidden="true"
            className="cursor-pointer transition-transform hover:scale-110"
            onPointerMove={(event) => setHover(valueAt(event, star))}
            onClick={(event) => {
              const next = valueAt(event, star);
              onChange(next === value ? null : next);
            }}
          >
            <StarGlyph fill={fillFor(shown, star)} className={starClassName} />
          </span>
        );
      })}
    </div>
  );
}
