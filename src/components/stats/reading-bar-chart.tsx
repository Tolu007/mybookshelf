import { buildMonthlyTotals, buildYearlyTotals, formatMinutes } from "@/lib/stats-aggregate";
import { cn } from "@/lib/utils";

type Bar = { key: string | number; label: string; minutes: number };

// Hours per bar against a labelled axis; the biggest bar gets the amber
// ribbon (none while there's no reading).
function HoursBarChart({ bars, caption }: { bars: Bar[]; caption: string }) {
  const maxHours = Math.max(1, ...bars.map((bar) => bar.minutes / 60));
  const peakMinutes = Math.max(...bars.map((bar) => bar.minutes));
  const peakKey = peakMinutes > 0 ? bars.find((bar) => bar.minutes === peakMinutes)?.key : undefined;
  const roughStep = maxHours / 4;
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const step = [1, 2, 2.5, 5, 10].find((value) => value * magnitude >= roughStep)! * magnitude;
  const axisMaxHours = step * 4;
  const ticks = Array.from({ length: 5 }, (_, index) => axisMaxHours - index * step);

  return (
    <figure className="grid min-w-120 grid-cols-[3rem_1fr] gap-x-3">
      <figcaption className="sr-only">{caption}</figcaption>
      <div>
        <div className="h-6 text-xs font-medium text-muted-foreground">Hours</div>
        <div className="relative h-44">
          {ticks.map((hours, index) => (
            <span
              key={index}
              className="absolute right-0 -translate-y-1/2 text-xs text-muted-foreground tabular-nums"
              style={{ top: `${(index / 4) * 100}%` }}
            >
              {Number(hours.toFixed(2))}
            </span>
          ))}
        </div>
      </div>
      <div>
        <div className="flex h-6 gap-2">
          {bars.map((bar) => (
            <span key={bar.key} className="flex-1 text-center text-xs text-muted-foreground tabular-nums">
              {bar.minutes > 0 ? formatMinutes(bar.minutes) : ""}
            </span>
          ))}
        </div>
        <div className="relative h-44">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            {ticks.map((_, index) => (
              <div key={index} className="absolute inset-x-0 border-t border-border" style={{ top: `${(index / 4) * 100}%` }} />
            ))}
          </div>
          <div className="relative flex h-full items-end gap-2">
            {bars.map((bar) => (
              <div key={bar.key} className="flex h-full flex-1 items-end justify-center">
                <div
                  title={`${bar.label}: ${formatMinutes(bar.minutes)}`}
                  className={cn(
                    "w-full max-w-10 rounded-t-sm transition-opacity hover:opacity-85",
                    bar.key === peakKey ? "bg-ribbon" : "bg-primary"
                  )}
                  style={{ height: `${(bar.minutes / 60 / axisMaxHours) * 100}%` }}
                />
              </div>
            ))}
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          {bars.map((bar) => (
            <span key={bar.key} className="flex-1 text-center text-xs text-muted-foreground">
              {bar.label}
            </span>
          ))}
        </div>
      </div>
    </figure>
  );
}

export function ReadingBarChart({
  dailyMinutes,
  year,
}: {
  dailyMinutes: Map<string, number>;
  year: number;
}) {
  const bars = buildMonthlyTotals(dailyMinutes, year).map((month) => ({ key: month.month, label: month.label, minutes: month.minutes }));
  return <HoursBarChart bars={bars} caption={`Monthly reading time in hours for ${year}`} />;
}

export function YearlyBarChart({ dailyMinutes, untilYear }: { dailyMinutes: Map<string, number>; untilYear: number }) {
  const bars = buildYearlyTotals(dailyMinutes, untilYear).map((entry) => ({ key: entry.year, label: String(entry.year), minutes: entry.minutes }));
  return <HoursBarChart bars={bars} caption="Reading time in hours, year by year" />;
}
