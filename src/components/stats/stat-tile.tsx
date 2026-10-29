import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function StatTile({
  label,
  icon: Icon,
  value,
  unit,
  accent = false,
  children,
}: {
  label: string;
  icon: ComponentType<{ className?: string }>;
  value: string;
  unit?: string;
  // The amber "highlight" tile (the design uses it for the streak).
  accent?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className={cn("surface flex min-w-0 flex-col p-4", accent && "bg-secondary dark:bg-card")}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-medium tracking-[0.06em] text-muted-foreground uppercase">{label}</p>
        <Icon className={cn("size-4 shrink-0", accent ? "text-amber" : "text-muted-foreground")} aria-hidden="true" />
      </div>
      <p className={cn("mt-3 font-heading text-[34px] leading-10 tracking-tight tabular-nums", accent && "font-semibold text-amber")}>
        {value}
        {unit && <span className="ml-1 font-sans text-sm font-normal text-muted-foreground">{unit}</span>}
      </p>
      {children && <div className="mt-auto space-y-2 pt-3 text-[11px] text-muted-foreground">{children}</div>}
    </div>
  );
}
