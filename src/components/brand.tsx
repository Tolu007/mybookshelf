import { BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary text-primary-foreground shadow-sm", className)}>
      <BookOpen className="size-[18px]" strokeWidth={1.6} aria-hidden="true" />
    </span>
  );
}

export function Brand({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2.5", className)}>
      <BrandMark />
      {!compact && (
        <span className="flex min-w-0 flex-col">
          <span className="font-heading text-xl leading-6 font-semibold tracking-tight text-sage">Shelf</span>
          <span className="text-[10px] font-medium tracking-[0.12em] text-muted-foreground uppercase">Personal library</span>
        </span>
      )}
    </span>
  );
}
