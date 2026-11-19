import { differenceInCalendarDays, eachDayOfInterval, endOfWeek, format, parseISO, startOfWeek } from "date-fns";

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

export function formatMinutes(minutes: number) {
  const total = Math.round(minutes);
  if (total < 60) return `${total}m`;
  return `${Math.floor(total / 60)}h ${total % 60}m`;
}

const WEEKDAYS = ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"];

// The weekday with the most reading, and its average minutes on the days
// you read. Null when there's no reading yet.
export function peakWeekday(dailyMinutes: Map<string, number>) {
  const totals = Array.from({ length: 7 }, () => ({ minutes: 0, days: 0 }));
  for (const [dateKey, minutes] of dailyMinutes) {
    if (minutes <= 0) continue;
    const day = new Date(`${dateKey}T00:00:00`).getDay();
    totals[day].minutes += minutes;
    totals[day].days += 1;
  }
  const best = totals.reduce((top, entry, day) => (entry.minutes > totals[top].minutes ? day : top), 0);
  if (totals[best].minutes === 0) return null;
  return { label: WEEKDAYS[best], averageMinutes: totals[best].minutes / totals[best].days };
}

export function countActiveDays(dailyMinutes: Map<string, number>, fromDate: string, toDate: string) {
  let count = 0;
  for (const [dateKey, minutes] of dailyMinutes) {
    if (minutes > 0 && dateKey >= fromDate && dateKey <= toDate) count += 1;
  }
  return count;
}

// The longest run of consecutive reading days in the map.
export function longestStreakIn(dailyMinutes: Map<string, number>) {
  const days = [...dailyMinutes].filter(([, minutes]) => minutes > 0).map(([day]) => day).sort();
  let best = 0;
  let run = 0;
  let previous: string | null = null;
  for (const day of days) {
    run = previous && differenceInCalendarDays(parseISO(day), parseISO(previous)) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    previous = day;
  }
  return best;
}

// Minutes per calendar year, oldest first, with quiet years filled in as 0.
export function buildYearlyTotals(dailyMinutes: Map<string, number>, untilYear: number) {
  const totals = new Map<number, number>();
  for (const [dateKey, minutes] of dailyMinutes) {
    const year = Number(dateKey.slice(0, 4));
    totals.set(year, (totals.get(year) ?? 0) + minutes);
  }
  if (totals.size === 0) return [{ year: untilYear, minutes: 0 }];
  const first = Math.min(...totals.keys());
  return Array.from({ length: untilYear - first + 1 }, (_, index) => ({
    year: first + index,
    minutes: Math.round(totals.get(first + index) ?? 0),
  }));
}

// Minutes read in each hour of the day (0-23, in the reader's own time
// zone), with a session that spans several hours split across them.
export function buildHourlyMinutes(sessions: { started_at: string; duration_seconds: number }[]) {
  const hours = Array.from({ length: 24 }, () => 0);
  for (const session of sessions) {
    let cursor = new Date(session.started_at).getTime();
    let remaining = session.duration_seconds * 1000;
    if (!Number.isFinite(cursor) || remaining <= 0) continue;
    while (remaining > 0) {
      const at = new Date(cursor);
      const nextHour = new Date(at.getFullYear(), at.getMonth(), at.getDate(), at.getHours() + 1).getTime();
      const slice = Math.min(remaining, nextHour - cursor);
      hours[at.getHours()] += slice / 60000;
      cursor += slice;
      remaining -= slice;
    }
  }
  return hours;
}

// The run of `width` consecutive hours (wrapping past midnight) holding the
// most reading. Null when nothing has been read.
export function bestReadingWindow(hours: number[], width = 2) {
  const total = hours.reduce((sum, minutes) => sum + minutes, 0);
  if (total <= 0) return null;
  let best = { start: 0, minutes: -1 };
  for (let start = 0; start < 24; start++) {
    let minutes = 0;
    for (let offset = 0; offset < width; offset++) minutes += hours[(start + offset) % 24];
    if (minutes > best.minutes) best = { start, minutes };
  }
  return { start: best.start, end: (best.start + width) % 24, minutes: best.minutes, share: best.minutes / total };
}

// 0 -> "12 am", 13 -> "1 pm".
export function hourLabel(hour: number) {
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h} ${hour < 12 ? "am" : "pm"}`;
}

// Reading time per shelf, largest first. Books not on a shelf share one
// "Unshelved" row; `books` counts the distinct books read on each shelf.
export function buildShelfTotals(
  sessions: { book_id: string; duration_seconds: number }[],
  shelfByBook: Map<string, string | null>
) {
  const totals = new Map<string, { minutes: number; books: Set<string> }>();
  for (const session of sessions) {
    if (!shelfByBook.has(session.book_id)) continue; // a deleted book
    const shelf = shelfByBook.get(session.book_id) ?? null;
    const key = shelf ?? "";
    const row = totals.get(key) ?? { minutes: 0, books: new Set<string>() };
    row.minutes += session.duration_seconds / 60;
    row.books.add(session.book_id);
    totals.set(key, row);
  }
  return [...totals]
    .map(([shelf, row]) => ({ shelf: shelf || null, minutes: row.minutes, books: row.books.size }))
    .filter((row) => row.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes);
}
