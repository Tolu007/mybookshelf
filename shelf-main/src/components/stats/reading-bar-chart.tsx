import { buildDailyBars } from "@/lib/stats-aggregate";

export function ReadingBarChart({ dailyMinutes }: { dailyMinutes: Map<string, number> }) {
  const bars = buildDailyBars(dailyMinutes, 30);
  const max = Math.max(1, ...bars.map((bar) => bar.minutes));

  return (
    <div className="flex h-32 items-end gap-1 border-b border-border">
      {bars.map((bar) => (
        <div
          key={bar.date}
          title={`${bar.date}: ${bar.minutes} min`}
          className="flex-1 rounded-t-xs bg-primary/80 transition-colors hover:bg-primary"
          style={{ height: `${Math.max(2, (bar.minutes / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}
