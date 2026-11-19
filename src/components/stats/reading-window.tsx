"use client";

import { useState, useSyncExternalStore } from "react";
import { bestReadingWindow, buildHourlyMinutes, formatMinutes, hourLabel } from "@/lib/stats-aggregate";
import { cn } from "@/lib/utils";

const subscribeNothing = () => () => {};

// Minutes read in each hour of the day, with your best two-hour window
// marked. Session times are stored in UTC, so the hours are worked out in
// the browser, in your own time zone; the server render shows a placeholder.
export function ReadingWindow({ sessions }: { sessions: { started_at: string; duration_seconds: number }[] }) {
  const isClient = useSyncExternalStore(subscribeNothing, () => true, () => false);
  const [hovered, setHovered] = useState<number | null>(null);

  if (!isClient) return <div className="h-52" aria-hidden="true" />;

  const hours = buildHourlyMinutes(sessions);
  const best = bestReadingWindow(hours);
  if (!best) return <p className="py-8 text-center text-sm text-muted-foreground">Read a little and your best time of day will show up here.</p>;

  const max = Math.max(...hours);
  const inBest = (hour: number) => (hour - best.start + 24) % 24 < 2;
  const focus = hovered ?? null;

  return (
    <figure className="space-y-3">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span>
          <span className="font-heading text-2xl leading-8 text-amber">{hourLabel(best.start)} – {hourLabel(best.end)}</span>
          <span className="ml-2 text-[13px] text-muted-foreground">{Math.round(best.share * 100)}% of your reading ({formatMinutes(best.minutes)})</span>
        </span>
        <span aria-live="polite" className="meta min-h-4">
          {focus !== null && `${hourLabel(focus)}–${hourLabel((focus + 1) % 24)}: ${hours[focus] > 0 ? formatMinutes(hours[focus]) : "nothing yet"}`}
        </span>
      </figcaption>
      <div className="relative h-36 border-b border-border" onMouseLeave={() => setHovered(null)}>
        <div className="flex h-full items-end gap-0.5">
          {hours.map((minutes, hour) => (
            <button
              key={hour}
              type="button"
              aria-label={`${hourLabel(hour)}: ${minutes > 0 ? formatMinutes(minutes) : "no reading"}`}
              onMouseEnter={() => setHovered(hour)}
              onFocus={() => setHovered(hour)}
              onBlur={() => setHovered(null)}
              className="group flex h-full min-w-0 flex-1 items-end rounded-sm outline-none focus-visible:bg-secondary"
            >
              <span
                className={cn(
                  "block w-full rounded-t-[4px] transition-opacity",
                  inBest(hour) ? "bg-ribbon" : "bg-primary",
                  focus !== null && focus !== hour && "opacity-50"
                )}
                style={{ height: minutes > 0 ? `max(2px, ${(minutes / max) * 100}%)` : 0 }}
              />
            </button>
          ))}
        </div>
      </div>
      <div className="flex text-[11px] text-muted-foreground" aria-hidden="true">
        {[0, 6, 12, 18].map((hour) => (
          <span key={hour} className="flex-1">{hourLabel(hour)}</span>
        ))}
      </div>
      <table className="sr-only">
        <caption>Minutes read in each hour of the day</caption>
        <tbody>
          {hours.map((minutes, hour) => (
            <tr key={hour}><th scope="row">{hourLabel(hour)}</th><td>{Math.round(minutes)} min</td></tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
