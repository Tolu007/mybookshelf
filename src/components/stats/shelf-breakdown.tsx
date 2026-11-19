import { formatMinutes } from "@/lib/stats-aggregate";

const MAX_ROWS = 6;

type ShelfRow = { shelf: string | null; minutes: number; books: number };

// Reading time per shelf (your genres) as ranked bars: one hue, one shared
// baseline, so the shelves compare at a glance. Past six, the rest fold
// into "Other shelves".
export function ShelfBreakdown({ rows }: { rows: ShelfRow[] }) {
  if (rows.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Reading time on each shelf will show up here.</p>;
  }

  const shown = rows.length > MAX_ROWS ? rows.slice(0, MAX_ROWS - 1) : rows;
  const rest = rows.slice(shown.length);
  const display = rest.length
    ? [...shown.map((row) => ({ ...row, label: row.shelf ?? "Unshelved" })), { label: `Other shelves (${rest.length})`, minutes: rest.reduce((sum, row) => sum + row.minutes, 0), books: rest.reduce((sum, row) => sum + row.books, 0), shelf: null }]
    : shown.map((row) => ({ ...row, label: row.shelf ?? "Unshelved" }));
  const total = rows.reduce((sum, row) => sum + row.minutes, 0);
  const max = Math.max(...display.map((row) => row.minutes));

  return (
    <ul className="space-y-3">
      {display.map((row) => {
        const share = Math.round((row.minutes / total) * 100);
        return (
          <li key={row.label} title={`${row.label}: ${formatMinutes(row.minutes)} · ${row.books} ${row.books === 1 ? "book" : "books"}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 sm:grid-cols-[10rem_minmax(0,1fr)_auto]">
            <span className="min-w-0 truncate text-sm">{row.label}</span>
            <span className="order-last col-span-2 h-2.5 rounded-full bg-secondary sm:order-none sm:col-span-1 dark:bg-background">
              <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.max(2, (row.minutes / max) * 100)}%` }} />
            </span>
            <span className="text-right text-xs text-muted-foreground tabular-nums">
              <span className="font-semibold text-foreground">{share}%</span> · {formatMinutes(row.minutes)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
