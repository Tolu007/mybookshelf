"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDownUp, ChevronDown, Filter } from "lucide-react";
import { SHELF_FILTERS, SORT_OPTIONS, libraryHref, type LibraryParams } from "@/lib/library";
import { cn } from "@/lib/utils";

function SelectControl({ label, icon: Icon, value, options, onChange }: {
  label: string;
  icon: typeof Filter;
  value: string;
  options: readonly { key: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="relative flex items-center">
      <span className="sr-only">{label}</span>
      <Icon className="pointer-events-none absolute left-2 size-3.5 text-muted-foreground" aria-hidden="true" />
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 cursor-pointer appearance-none rounded-lg border border-border bg-background py-1 pr-7 pl-7 text-xs font-semibold tracking-[0.02em] text-foreground transition-colors outline-none hover:bg-secondary focus-visible:ring-3 focus-visible:ring-primary/15 dark:bg-secondary"
      >
        {options.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 size-3.5 text-muted-foreground" aria-hidden="true" />
    </label>
  );
}

// Format pills, shelf and sort pickers. All state lives in the URL so the
// server renders the filtered shelves.
export function LibraryFilters({ params, formatCounts }: {
  params: LibraryParams;
  formatCounts: { all: number; epub: number; pdf: number };
}) {
  const router = useRouter();
  const formats = [
    { key: "", label: "All formats", count: formatCounts.all },
    { key: "epub", label: "EPUB", count: formatCounts.epub },
    { key: "pdf", label: "PDF", count: formatCounts.pdf },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-1.5 shadow-[var(--shadow-card)]">
      <nav aria-label="Filter by format" className="flex items-center rounded-lg border border-border bg-secondary p-0.5">
        {formats.map((format) => {
          const active = (params.format ?? "") === format.key;
          return (
            <Link
              key={format.key}
              href={libraryHref(params, { format: format.key })}
              aria-current={active ? "page" : undefined}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-semibold tracking-[0.02em] whitespace-nowrap transition-colors",
                active ? "border border-primary/20 bg-background text-sage shadow-sm dark:bg-popover" : "border border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {format.label}{format.key && <span className="font-normal tabular-nums"> ({format.count})</span>}
            </Link>
          );
        })}
      </nav>
      <SelectControl label="Show shelf" icon={Filter} value={params.shelf ?? ""} options={SHELF_FILTERS} onChange={(shelf) => router.push(libraryHref(params, { shelf }))} />
      <SelectControl label="Sort books" icon={ArrowDownUp} value={params.sort ?? "recent"} options={SORT_OPTIONS} onChange={(sort) => router.push(libraryHref(params, { sort: sort === "recent" ? "" : sort }))} />
    </div>
  );
}
