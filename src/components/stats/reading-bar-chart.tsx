import { buildMonthlyTotals, formatMinutes } from "@/lib/stats-aggregate";

export function ReadingBarChart({
  dailyMinutes,
  year,
}: {
  dailyMinutes: Map<string, number>;
  year: number;
}) {
  const months = buildMonthlyTotals(dailyMinutes, year);
  const max = Math.max(1, ...months.map((month) => month.minutes));

  return (
    <div className="min-w-120 space-y-3">
      <div className="flex items-end gap-2">
        {months.map((month) => (
          <div key={month.month} className="flex flex-1 flex-col items-center">
            <span className="h-4 text-xs text-muted-foreground tabular-nums">
              {month.minutes > 0 ? formatMinutes(month.minutes) : ""}
            </span>
            <div className="mt-2 flex h-44 w-full items-end justify-center border-b border-border">
              <div
                title={`${month.label}: ${formatMinutes(month.minutes)}`}
                className="w-full max-w-10 rounded-t-md bg-primary/75 transition-colors hover:bg-primary"
                style={{ height: `${(month.minutes / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        {months.map((month) => (
          <span key={month.month} className="flex-1 text-center text-xs text-muted-foreground">
            {month.label}
          </span>
        ))}
      </div>
    </div>
  );
}
