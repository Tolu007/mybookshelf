import { addDays, addMonths, addYears, differenceInCalendarDays, format, startOfDay, subMonths, subYears } from "date-fns";

// "On this day": journal entries and highlights written on today's date in
// earlier years. When there are none, the same week in earlier years, then
// a month ago, so a newer library still has something to resurface.

export type MemoryEntry = {
  id: string;
  kind: "note" | "highlight";
  note: string | null;
  excerpt: string | null;
  location: string | null;
  createdAt: string;
  color?: string | null;
  book: { id: string; title: string } | null;
};

export type Memory = { entry: MemoryEntry; label: string };

// Days either side of the date that still count as "this week".
export const NEARBY_DAYS = 3;
export const MAX_YEARS_BACK = 25;

function yearsLabel(years: number) {
  return years === 1 ? "1 year ago" : `${years} years ago`;
}

// The [from, to) UTC ranges worth fetching for `now`: a week around today
// in each earlier year back to `firstYear`, and around a month ago. A day
// of slack each side covers any time zone.
export function memoryRanges(now: Date, firstYear: number) {
  const ranges: { from: string; to: string }[] = [];
  const around = (date: Date) => ({
    from: addDays(startOfDay(date), -(NEARBY_DAYS + 1)).toISOString(),
    to: addDays(startOfDay(date), NEARBY_DAYS + 2).toISOString(),
  });
  ranges.push(around(subMonths(now, 1)));
  for (let years = 1; years <= MAX_YEARS_BACK && now.getFullYear() - years >= firstYear; years++) {
    ranges.push(around(subYears(now, years)));
  }
  return ranges;
}

// Picks what to show for `now` (in the viewer's time zone): same day in
// earlier years first, then the same week, then about a month ago. Newest
// memories first within each.
export function pickMemories(entries: MemoryEntry[], now: Date): Memory[] {
  const today = startOfDay(now);
  const sameDay: Memory[] = [];
  const sameWeek: Memory[] = [];
  const monthAgo: Memory[] = [];

  for (const entry of entries) {
    const written = startOfDay(new Date(entry.createdAt));
    if (Number.isNaN(written.getTime()) || written >= today) continue;

    let matched = false;
    for (let years = 1; years <= MAX_YEARS_BACK; years++) {
      const anniversary = startOfDay(addYears(written, years));
      const offset = differenceInCalendarDays(today, anniversary);
      if (offset === 0) {
        sameDay.push({ entry, label: yearsLabel(years) });
        matched = true;
        break;
      }
      if (Math.abs(offset) <= NEARBY_DAYS) {
        sameWeek.push({ entry, label: `This week, ${yearsLabel(years)}` });
        matched = true;
        break;
      }
      if (anniversary > today) break;
    }
    if (matched) continue;

    const monthOffset = differenceInCalendarDays(today, startOfDay(addMonths(written, 1)));
    if (Math.abs(monthOffset) <= NEARBY_DAYS) {
      monthAgo.push({ entry, label: monthOffset === 0 ? "A month ago today" : `A month ago, ${format(written, "MMM d")}` });
    }
  }

  const newestFirst = (a: Memory, b: Memory) => b.entry.createdAt.localeCompare(a.entry.createdAt);
  if (sameDay.length) return sameDay.sort(newestFirst);
  if (sameWeek.length) return sameWeek.sort(newestFirst);
  return monthAgo.sort(newestFirst);
}
