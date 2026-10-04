import { buildHeatmapWeeks } from "@/lib/stats-aggregate";

const LEVEL_VAR = ["--heat-0", "--heat-1", "--heat-2", "--heat-3", "--heat-4", "--heat-5"];

export function StreakHeatmap({ dailyMinutes }: { dailyMinutes: Map<string, number> }) {
  const weeks = buildHeatmapWeeks(dailyMinutes, 12);

  return (
    <div className="space-y-2">
      <div className="flex gap-1 overflow-x-auto pb-1">
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="flex flex-col gap-1">
            {week.map((cell, dayIndex) =>
              cell ? (
                <div
                  key={cell.date}
                  title={`${cell.date}: ${Math.round(cell.minutes)} min`}
                  className="size-3 rounded-xs"
                  style={{ backgroundColor: `var(${LEVEL_VAR[cell.level]})` }}
                />
              ) : (
                <div key={dayIndex} className="size-3" />
              )
            )}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <span>Less</span>
        {LEVEL_VAR.map((levelVar) => (
          <div
            key={levelVar}
            className="size-3 rounded-xs"
            style={{ backgroundColor: `var(${levelVar})` }}
          />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}
