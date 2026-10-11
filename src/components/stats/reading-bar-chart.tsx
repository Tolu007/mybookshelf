import { buildMonthlyTotals, formatMinutes } from "@/lib/stats-aggregate";

export function ReadingBarChart({
  dailyMinutes,
  year,
}: {
  dailyMinutes: Map<string, number>;
  year: number;
}) {
  const months = buildMonthlyTotals(dailyMinutes, year);
  const maxHours = Math.max(1, ...months.map((month) => month.minutes / 60));
  const roughStep = maxHours / 4;
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const step = [1, 2, 2.5, 5, 10].find((value) => value * magnitude >= roughStep)! * magnitude;
  const axisMaxHours = step * 4;
  const ticks = Array.from({ length: 5 }, (_, index) => axisMaxHours - index * step);

  return (
    <figure className="grid min-w-120 grid-cols-[3rem_1fr] gap-x-3">
      <figcaption className="sr-only">Monthly reading time in hours for {year}</figcaption>
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
          {months.map((month) => (
            <span key={month.month} className="flex-1 text-center text-xs text-muted-foreground tabular-nums">
              {month.minutes > 0 ? formatMinutes(month.minutes) : ""}
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
            {months.map((month) => (
              <div key={month.month} className="flex h-full flex-1 items-end justify-center">
                <div
                  title={`${month.label}: ${formatMinutes(month.minutes)}`}
                  className="w-full max-w-10 rounded-t-md bg-primary/75 transition-colors hover:bg-primary"
                  style={{ height: `${(month.minutes / 60 / axisMaxHours) * 100}%` }}
                />
              </div>
            ))}
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          {months.map((month) => (
            <span key={month.month} className="flex-1 text-center text-xs text-muted-foreground">
              {month.label}
            </span>
          ))}
        </div>
      </div>
    </figure>
  );
}
