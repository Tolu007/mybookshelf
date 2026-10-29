import Link from "next/link";
import { ArrowRight, Highlighter, PenLine } from "lucide-react";
import { BookCover } from "@/components/book-cover";
import { FormatBadge } from "@/components/book-card";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type ReadingCardBook = {
  id: string;
  title: string;
  author: string | null;
  cover_url: string | null;
  format: string;
};

export function ProgressRibbon({ value, label, className }: { value: number; label: string; className?: string }) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(clamped)} className={cn("h-1.5 overflow-hidden rounded-full bg-secondary", className)}>
      <div className="h-full rounded-full bg-ribbon" style={{ width: `${clamped}%` }} />
    </div>
  );
}

// A book in flight: cover, progress ribbon, note counts and a resume action.
export function ReadingCard({
  book,
  percent,
  location,
  categoryName,
  lastReadLabel,
  notes,
  highlights,
  primary = false,
}: {
  book: ReadingCardBook;
  percent: number;
  location: string | null;
  categoryName: string | null;
  lastReadLabel: string | null;
  notes: number;
  highlights: number;
  primary?: boolean;
}) {
  const href = `/read/${book.id}`;
  // PDFs store a page number; EPUBs store a CFI, which means nothing to a reader.
  const position = book.format === "pdf" && location && /^\d+$/.test(location) ? `Page ${location}` : `${Math.round(percent)}% through`;

  return (
    <article className="surface surface-lift flex min-w-0 flex-col justify-between gap-4 p-4">
      <div className="flex gap-4">
        <Link href={href} aria-label={`Resume ${book.title}`} className="relative w-24 shrink-0 overflow-hidden rounded-md bg-well ring-1 ring-border sm:w-28">
          <BookCover title={book.title} author={book.author} coverUrl={book.cover_url} sizes="112px" />
          <FormatBadge format={book.format} className="absolute top-1.5 left-1.5" />
        </Link>
        <div className="flex min-w-0 flex-1 flex-col justify-between gap-3">
          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="truncate text-[11px] font-semibold tracking-[0.06em] text-amber uppercase">{categoryName ?? "Reading now"}</span>
              {lastReadLabel && <span className="meta shrink-0">{lastReadLabel}</span>}
            </div>
            <h3 className="truncate font-heading text-lg leading-6 font-semibold">
              <Link href={href} className="hover:text-sage">{book.title}</Link>
            </h3>
            <p className="truncate text-[13px] text-muted-foreground">{book.author ?? "Unknown author"}</p>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="meta">{position}</span>
              <span className="text-[11px] font-semibold text-sage tabular-nums">{Math.round(percent)}%</span>
            </div>
            <ProgressRibbon value={percent} label={`Reading progress for ${book.title}`} />
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
        <span className="meta flex min-w-0 items-center gap-3">
          <span className="flex items-center gap-1"><PenLine className="size-3.5" aria-hidden="true" /> {notes} {notes === 1 ? "note" : "notes"}</span>
          <span className="flex items-center gap-1"><Highlighter className="size-3.5" aria-hidden="true" /> {highlights}<span className="sr-only"> highlights</span></span>
        </span>
        <Link href={href} className={cn(buttonVariants({ size: "sm", variant: primary ? "default" : "outline" }), "shrink-0")}>
          {primary ? "Resume" : "Continue"} <ArrowRight />
        </Link>
      </div>
    </article>
  );
}
