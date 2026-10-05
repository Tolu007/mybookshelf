import { eachDayOfInterval, endOfWeek, format, startOfMonth, startOfWeek } from "date-fns";

export type SessionRow = { local_date: string; duration_seconds: number };

export type HeatCell = {
  date: string;
  minutes: number;
  level: 0 | 1 | 2 | 3 | 4 | 5;
  inYear: boolean;
};

export function sumMinutes(rows: SessionRow[], fromDate?: string) {
  return (
    rows
      .filter((row) => !fromDate || row.local_date >= fromDate)
      .reduce((total, row) => total + row.duration_seconds, 0) / 60
  );
}

export function buildDailyMinutesMap(rows: SessionRow[]) {
  const map = new Map<string, number>();
  for (const row of rows) {
    map.set(row.local_date, (map.get(row.local_date) ?? 0) + row.duration_seconds / 60);
  }
  return map;
}

export function minutesToHeatLevel(minutes: number): HeatCell["level"] {
  if (minutes <= 0) return 0;
  if (minutes < 15) return 1;
  if (minutes < 30) return 2;
  if (minutes < 60) return 3;
  if (minutes < 120) return 4;
  return 5;
}

// A GitHub-style contribution graph for the whole calendar year: columns are
// weeks (Jan 1 through Dec 31, padded to complete weeks), rows are days.
// Days outside the target year (the padding) are marked `inYear: false` so
// the component can render them as blank rather than a false "0 minutes".
export function buildYearHeatmapWeeks(dailyMinutes: Map<string, number>, year: number) {
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31);
  const gridStart = startOfWeek(yearStart, { weekStartsOn: 0 });
  const gridEnd = endOfWeek(yearEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const cells: HeatCell[] = days.map((date) => {
    const key = format(date, "yyyy-MM-dd");
    const minutes = dailyMinutes.get(key) ?? 0;
    return {
      date: key,
      minutes,
      level: minutesToHeatLevel(minutes),
      inYear: date.getFullYear() === year,
    };
  });

  const columns: HeatCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    columns.push(cells.slice(i, i + 7));
  }

  // The column index (and label) of each month's first week, so the
  // component can print "Jan Feb Mar …" above the right columns.
  const monthMarkers: { column: number; label: string }[] = [];
  let lastMonth = -1;
  columns.forEach((column, index) => {
    const firstInYearCell = column.find((cell) => cell.inYear);
    if (!firstInYearCell) return;
    const month = new Date(firstInYearCell.date).getMonth();
    if (month !== lastMonth) {
      monthMarkers.push({ column: index, label: format(new Date(firstInYearCell.date), "MMM") });
      lastMonth = month;
    }
  });

  return { columns, monthMarkers };
}

// Jan-Dec totals for the target year, in minutes.
export function buildMonthlyTotals(dailyMinutes: Map<string, number>, year: number) {
  const totals = Array.from({ length: 12 }, () => 0);
  for (const [dateKey, minutes] of dailyMinutes) {
    const date = new Date(`${dateKey}T00:00:00`);
    if (date.getFullYear() === year) {
      totals[date.getMonth()] += minutes;
    }
  }
  return totals.map((minutes, month) => ({
    month,
    label: format(new Date(year, month, 1), "MMM"),
    minutes: Math.round(minutes),
  }));
}

export function yearStartIso(year: number) {
  return format(new Date(year, 0, 1), "yyyy-MM-dd");
}

export function monthStartIso() {
  return format(startOfMonth(new Date()), "yyyy-MM-dd");
}

export function formatMinutes(minutes: number) {
  const total = Math.round(minutes);
  if (total < 60) return `${total}m`;
  return `${Math.floor(total / 60)}h ${total % 60}m`;
}
