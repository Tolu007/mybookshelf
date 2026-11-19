"use client";

import { useSyncExternalStore } from "react";
import {
  DEFAULT_HIGHLIGHT_COLOR,
  HIGHLIGHT_COLORS,
  loadHighlightColor,
  pickHighlightColor,
  subscribeHighlightColor,
  type HighlightColor,
} from "@/lib/highlight-colors";
import { cn } from "@/lib/utils";

// The colour new highlights are made in. The server render can't see the
// saved choice, so it starts on the default and updates after hydrating.
export function useHighlightColor(): HighlightColor {
  return useSyncExternalStore(subscribeHighlightColor, loadHighlightColor, () => DEFAULT_HIGHLIGHT_COLOR);
}

export function HighlightColorPicker({ value }: { value: HighlightColor }) {
  return (
    <div role="radiogroup" aria-label="Highlight colour" className="flex items-center gap-1 rounded-lg bg-secondary px-1.5 py-1">
      {HIGHLIGHT_COLORS.map((color) => (
        <button
          key={color.key}
          type="button"
          role="radio"
          aria-checked={value === color.key}
          aria-label={`${color.label} highlight`}
          title={color.label}
          onClick={() => pickHighlightColor(color.key)}
          className={cn(
            "size-5 rounded-full border-2 transition-transform focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none",
            value === color.key ? "scale-110 border-foreground" : "border-transparent hover:scale-110"
          )}
          style={{ backgroundColor: color.fill }}
        />
      ))}
    </div>
  );
}
