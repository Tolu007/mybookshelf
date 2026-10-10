import { BookCheck, Clock3, Flame, CalendarDays, Trophy, Sun } from "lucide-react";

const ICONS = { "Current streak": Flame, "Longest streak": Trophy, "Books finished": BookCheck, "Time read": Clock3, "This month": CalendarDays, "Today": Sun };

export function StatTile({
  label,
  value,
  sublabel,
}: {
  label: string;
  value: string;
  sublabel?: string;
}) {
  const Icon = ICONS[label as keyof typeof ICONS] ?? Clock3;
  return (
    <div className="surface min-w-0 p-4">
      <Icon className="mb-4 size-4 text-primary/80" strokeWidth={1.6} aria-hidden="true" />
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="mt-2 break-words font-heading text-[28px] leading-tight tracking-tight tabular-nums">{value}</p>
      {sublabel && <p className="mt-1 text-xs text-muted-foreground">{sublabel}</p>}
    </div>
  );
}
