import { buildYearHeatmapWeeks } from "@/lib/stats-aggregate";

const LEVEL_VAR = ["--heat-0", "--heat-1", "--heat-2", "--heat-3", "--heat-4", "--heat-5"];
const CELL_PX = 12; // size-3, matches the w-3/h-3 cell className below
const GAP_PX = 4; // gap-1

export function StreakHeatmap({
  dailyMinutes,
  year,
}: {
  dailyMinutes: Map<string, number>;
  year: number;
}) {
  const { columns, monthMarkers } = buildYearHeatmapWeeks(dailyMinutes, year);

  return (
    <div className="space-y-1">
      <div className="relative h-4" style={{ width: columns.length * (CELL_PX + GAP_PX) }}>
        {monthMarkers.map((marker) => (
          <span
            key={marker.column}
            className="absolute text-xs text-muted-foreground"
            style={{ left: marker.column * (CELL_PX + GAP_PX) }}
          >
            {marker.label}
          </span>
        ))}
      </div>
      <div className="flex gap-1 overflow-x-auto pb-1">
        {columns.map((week, weekIndex) => (
          <div key={weekIndex} className="flex flex-col gap-1">
            {week.map((cell, dayIndex) =>
              cell.inYear ? (
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
