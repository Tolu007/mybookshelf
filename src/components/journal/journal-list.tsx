"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { ArrowUpRight, BookOpen, Clock3, Feather, Highlighter, NotebookPen, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type JournalEntry = {
  id: string;
  kind: "note" | "highlight";
  note: string | null;
  excerpt: string | null;
  location: string | null;
  createdAt: string;
  book: { id: string; title: string; format: string } | null;
};

const TABS = [
  { key: "all", label: "All entries" },
  { key: "in_book", label: "In-book notes" },
  { key: "standalone", label: "Standalone" },
  { key: "highlights", label: "Highlights" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function inTab(entry: JournalEntry, tab: TabKey) {
  switch (tab) {
    case "in_book":
      return entry.kind === "note" && entry.book !== null;
    case "standalone":
      return entry.kind === "note" && entry.book === null;
    case "highlights":
      return entry.kind === "highlight";
    default:
      return true;
  }
}

// PDFs store a page number; EPUB CFIs mean nothing to a reader.
function positionLabel(entry: JournalEntry) {
  return entry.book?.format === "pdf" && entry.location && /^\d+$/.test(entry.location) ? `Page ${entry.location}` : null;
}

function EntryLabel({ entry }: { entry: JournalEntry }) {
  const label =
    entry.kind === "highlight"
      ? { icon: Highlighter, text: "Highlight" }
      : entry.book
        ? { icon: NotebookPen, text: "In-book note" }
        : { icon: Feather, text: "Standalone reflection" };
  return (
    <span className={cn("tag", entry.book ? "text-sage" : "text-amber")}>
      <label.icon className="size-3" aria-hidden="true" /> {label.text}
    </span>
  );
}

export function JournalList({ initialEntries }: { initialEntries: JournalEntry[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("all");
  // Derive from refreshed server props instead of keeping a stale copy of the list.
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const entries = initialEntries.filter((entry) => !hiddenIds.includes(entry.id));
  const shown = entries.filter((entry) => inTab(entry, tab));

  async function remove(id: string) {
    setError(null);
    setHiddenIds((prev) => [...prev, id]);
    try {
      const response = await fetch(`/api/annotations/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("This entry couldn't be deleted. Please try again.");
      router.refresh();
    } catch {
      setHiddenIds((prev) => prev.filter((hiddenId) => hiddenId !== id));
      setError("This entry couldn't be deleted. Please try again.");
    }
  }

  return (
    <div className="space-y-5">
      <div role="tablist" aria-label="Filter entries" className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1">
        {TABS.map((item) => {
          const count = entries.filter((entry) => inTab(entry, item.key)).length;
          const active = tab === item.key;
          return (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(item.key)}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold tracking-[0.02em] whitespace-nowrap transition-colors",
                active ? "border-primary/30 bg-primary text-primary-foreground" : "border-transparent text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              {item.label}
              <span className={cn("rounded-sm px-1.5 py-px text-[10px] tabular-nums", active ? "bg-black/15" : "bg-secondary")}>{count}</span>
            </button>
          );
        })}
      </div>

      {error && <p role="alert" className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p>}

      {shown.length === 0 ? (
        <div className="surface flex flex-col items-center px-6 py-16 text-center">
          <span className="mb-5 flex size-14 items-center justify-center rounded-full border border-border bg-secondary text-sage"><NotebookPen className="size-6" strokeWidth={1.5} aria-hidden="true" /></span>
          <h2 className="font-heading text-2xl">{tab === "highlights" ? "No highlights yet." : "Good thoughts deserve a place."}</h2>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
            {tab === "highlights"
              ? "Turn on highlight mode while reading and select a passage. It will be kept here."
              : "Write about a book, or about anything at all, at the writing desk above."}
          </p>
          <Link href="/" className="mt-5 inline-flex items-center gap-2 text-xs font-semibold text-sage hover:underline">Find a book to get lost in <ArrowUpRight className="size-3.5" /></Link>
        </div>
      ) : (
        <div className="space-y-4">
          {shown.map((entry) => {
            const position = positionLabel(entry);
            const kindLabel = entry.kind === "highlight" ? "highlight" : "note";
            return (
              <article key={entry.id} className="surface min-w-0 overflow-hidden">
                <div className="flex items-start justify-between gap-3 px-5 pt-4">
                  <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                    <EntryLabel entry={entry} />
                    {entry.book ? (
                      <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                        Linked to: <span className="truncate font-heading text-sm font-semibold text-foreground">{entry.book.title}</span>
                        {position && <span className="meta">· {position}</span>}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Unbound reflection</span>
                    )}
                  </div>
                  <Button variant="ghost" size="icon-sm" aria-label={entry.book ? `Delete ${kindLabel} from ${entry.book.title}` : "Delete entry"} onClick={() => remove(entry.id)} className="shrink-0 text-muted-foreground hover:text-destructive"><Trash2 className="size-3.5" /></Button>
                </div>
                <div className="space-y-3 px-5 py-4">
                  {entry.excerpt && (
                    <blockquote className="rounded-r-md border-l-2 border-sage bg-card py-2.5 pr-3 pl-4 font-heading text-[17px] leading-7 text-muted-foreground italic dark:bg-background">
                      &ldquo;{entry.excerpt}&rdquo;
                    </blockquote>
                  )}
                  {entry.note && <p className="font-heading text-[17px] leading-7 break-words whitespace-pre-wrap">{entry.note}</p>}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-card px-5 py-2.5">
                  <time dateTime={entry.createdAt} className="meta flex items-center gap-1.5"><Clock3 className="size-3" aria-hidden="true" /> {format(new Date(entry.createdAt), "MMM d, yyyy · h:mm a")}</time>
                  {entry.book && (
                    <Link href={{ pathname: `/read/${entry.book.id}`, query: entry.location ? { location: entry.location } : {} }} className="flex items-center gap-1.5 text-xs font-semibold text-sage hover:underline">
                      <BookOpen className="size-3.5" aria-hidden="true" /> {entry.location ? "Return to this moment" : "Open book"} <ArrowUpRight className="size-3.5" aria-hidden="true" />
                    </Link>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
