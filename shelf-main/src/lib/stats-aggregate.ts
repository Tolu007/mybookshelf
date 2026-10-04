import { addDays, eachDayOfInterval, format, startOfMonth, startOfWeek } from "date-fns";

export type SessionRow = { local_date: string; duration_seconds: number };

export type HeatCell = {
  date: string;
  minutes: number;
  level: 0 | 1 | 2 | 3 | 4 | 5;
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

export function buildHeatmapWeeks(dailyMinutes: Map<string, number>, weeks = 12) {
  const today = new Date();
  const start = addDays(today, -(weeks * 7 - 1));
  const gridStart = startOfWeek(start, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: gridStart, end: today });

  const cells: HeatCell[] = days.map((date) => {
    const key = format(date, "yyyy-MM-dd");
    const minutes = dailyMinutes.get(key) ?? 0;
    return { date: key, minutes, level: minutesToHeatLevel(minutes) };
  });

  const columns: (HeatCell | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    const chunk: (HeatCell | null)[] = cells.slice(i, i + 7);
    while (chunk.length < 7) chunk.push(null);
    columns.push(chunk);
  }
  return columns;
}

export function buildDailyBars(dailyMinutes: Map<string, number>, days = 30) {
  const today = new Date();
  return eachDayOfInterval({ start: addDays(today, -(days - 1)), end: today }).map((date) => {
    const key = format(date, "yyyy-MM-dd");
    return { date: key, minutes: Math.round(dailyMinutes.get(key) ?? 0) };
  });
}

export function weekStartIso() {
  return format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
}

export function monthStartIso() {
  return format(startOfMonth(new Date()), "yyyy-MM-dd");
}

export function formatMinutes(minutes: number) {
  const total = Math.round(minutes);
  if (total < 60) return `${total}m`;
  return `${Math.floor(total / 60)}h ${total % 60}m`;
}
