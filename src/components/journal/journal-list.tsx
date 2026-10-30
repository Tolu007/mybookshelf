"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { ArrowUpRight, BookOpen, Clock3, Feather, Highlighter, NotebookPen, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { JOURNAL_TABS, journalHref, splitOnMatches, type JournalEntry, type JournalTab } from "@/lib/journal";
import { cn } from "@/lib/utils";

export type { JournalEntry } from "@/lib/journal";

// Marks each occurrence of the search text.
function Highlighted({ text, query }: { text: string; query: string }) {
  const parts = splitOnMatches(text, query);
  return (
    <>
      {parts.map((part, index) =>
        index % 2 === 1 ? <mark key={index} className="rounded-sm bg-ribbon/30 text-inherit">{part}</mark> : part
      )}
    </>
  );
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

// The server filters by tab and search; this renders the result.
export function JournalList({ entries, counts, tab, query }: {
  entries: JournalEntry[];
  counts: Record<JournalTab, number>;
  tab: JournalTab;
  query: string;
}) {
  const router = useRouter();
  // Derive from refreshed server props instead of keeping a stale copy of the list.
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const shown = entries.filter((entry) => !hiddenIds.includes(entry.id));

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
      <form action="/journal" method="get" role="search" className="relative">
        {tab !== "all" && <input type="hidden" name="tab" value={tab} />}
        <label htmlFor="journal-search" className="sr-only">Search your journal</label>
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <input
          id="journal-search"
          key={query}
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search notes, highlights and book titles…"
          className="h-10 w-full rounded-lg border border-border bg-card pr-3 pl-9 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-sage/60 focus-visible:bg-background focus-visible:ring-3 focus-visible:ring-primary/15 dark:bg-secondary dark:focus-visible:bg-popover"
        />
      </form>

      {query && (
        <p role="status" className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>{counts[tab]} {counts[tab] === 1 ? "entry matches" : "entries match"} &ldquo;<span className="font-semibold text-foreground">{query}</span>&rdquo;</span>
          <Link href={journalHref({ tab })} className="inline-flex items-center gap-1 text-xs font-semibold text-sage hover:underline"><X className="size-3.5" aria-hidden="true" /> Clear search</Link>
        </p>
      )}

      <nav aria-label="Filter entries" className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1">
        {JOURNAL_TABS.map((item) => {
          const active = tab === item.key;
          return (
            <Link
              key={item.key}
              href={journalHref({ q: query, tab: item.key })}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold tracking-[0.02em] whitespace-nowrap transition-colors",
                active ? "border-primary/30 bg-primary text-primary-foreground" : "border-transparent text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              {item.label}
              <span className={cn("rounded-sm px-1.5 py-px text-[10px] tabular-nums", active ? "bg-black/15" : "bg-secondary")}>{counts[item.key]}</span>
            </Link>
          );
        })}
      </nav>

      {error && <p role="alert" className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p>}

      {shown.length === 0 ? (
        <div className="surface flex flex-col items-center px-6 py-16 text-center">
          <span className="mb-5 flex size-14 items-center justify-center rounded-full border border-border bg-secondary text-sage"><NotebookPen className="size-6" strokeWidth={1.5} aria-hidden="true" /></span>
          <h2 className="font-heading text-2xl">{query ? "Nothing matches that search." : tab === "highlights" ? "No highlights yet." : "Good thoughts deserve a place."}</h2>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
            {query
              ? "Try another word, or clear the search to see everything."
              : tab === "highlights"
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
                        Linked to: <span className="truncate font-heading text-sm font-semibold text-foreground"><Highlighted text={entry.book.title} query={query} /></span>
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
                      &ldquo;<Highlighted text={entry.excerpt} query={query} />&rdquo;
                    </blockquote>
                  )}
                  {entry.note && <p className="font-heading text-[17px] leading-7 break-words whitespace-pre-wrap"><Highlighted text={entry.note} query={query} /></p>}
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
