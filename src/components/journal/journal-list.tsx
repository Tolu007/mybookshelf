"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Check, Clock3, Feather, FolderOpen, Highlighter, NotebookPen, Pencil, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { JOURNAL_TABS, journalHref, splitOnMatches, type JournalEntry, type JournalGroup, type JournalPage, type JournalTab } from "@/lib/journal";
import { sendOrQueue } from "@/lib/offline-queue";
import { HIGHLIGHT_COLORS, highlightColor, type HighlightColor } from "@/lib/highlight-colors";
import { TagInput } from "@/components/journal/tag-input";
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

// What the edit form changes on an entry.
type Draft = { note: string; groupId: string; tags: string[]; color: HighlightColor };

function draftOf(entry: JournalEntry): Draft {
  return { note: entry.note ?? "", groupId: entry.group?.id ?? "", tags: entry.tags ?? [], color: highlightColor(entry.color).key };
}

function sameDraft(a: Draft, b: Draft) {
  return a.note === b.note && a.groupId === b.groupId && a.color === b.color && a.tags.join(" ") === b.tags.join(" ");
}

// The server filters by tab and search; this renders the result.
export function JournalList({ entries, counts, tab, query, pagination, groups = [], group, tag, tagSuggestions = [] }: {
  entries: JournalEntry[];
  counts: Record<JournalTab, number>;
  tab: JournalTab;
  query: string;
  pagination: JournalPage;
  groups?: JournalGroup[];
  group?: string;
  tag?: string;
  tagSuggestions?: string[];
}) {
  const router = useRouter();
  // Derive from refreshed server props instead of keeping a stale copy of the list.
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<({ id: string } & Draft) | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  // Edits saved offline: shown here until the queue syncs and a refresh
  // brings back the same entry from the server.
  const [queued, setQueued] = useState<Record<string, Draft>>({});
  const groupById = new Map(groups.map((item) => [item.id, item]));
  const shown = entries
    .filter((entry) => !hiddenIds.includes(entry.id))
    .map((entry) => {
      const edit = queued[entry.id];
      if (!edit || sameDraft(edit, draftOf(entry))) return { entry, pendingSync: false };
      return {
        entry: { ...entry, note: edit.note || null, group: groupById.get(edit.groupId) ?? null, tags: edit.tags, color: entry.kind === "highlight" ? edit.color : entry.color },
        pendingSync: true,
      };
    });

  function startEdit(entry: JournalEntry) {
    setError(null);
    setEditing({ id: entry.id, ...draftOf(entry) });
  }

  async function saveEdit(entry: JournalEntry) {
    if (!editing || savingEdit) return;
    if (entry.kind === "note" && !editing.note.trim()) return;
    setSavingEdit(true);
    setError(null);
    const edit: Draft = { note: editing.note.trim(), groupId: editing.groupId, tags: editing.tags, color: editing.color };
    try {
      // Only the latest edit to an entry matters, so a newer queued edit
      // replaces an older one instead of piling up.
      const response = await sendOrQueue(
        `/api/annotations/${entry.id}`,
        "PATCH",
        { note: edit.note, groupId: edit.groupId || null, tags: edit.tags, ...(entry.kind === "highlight" ? { color: edit.color } : {}) },
        { dedupe: true }
      );
      if (response && !response.ok) throw new Error();
      setEditing(null);
      if (response) {
        setQueued((prev) => {
          const rest = { ...prev };
          delete rest[entry.id];
          return rest;
        });
        router.refresh();
      } else {
        setQueued((prev) => ({ ...prev, [entry.id]: edit }));
      }
    } catch {
      setError("Your changes couldn't be saved. Your edit is still open.");
    } finally {
      setSavingEdit(false);
    }
  }

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
        {group && <input type="hidden" name="group" value={group} />}
        {tag && <input type="hidden" name="tag" value={tag} />}
        <label htmlFor="journal-search" className="sr-only">Search your journal</label>
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <input
          id="journal-search"
          key={query}
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search notes, highlights, books and #tags…"
          className="h-10 w-full rounded-lg border border-border bg-card pr-3 pl-9 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-sage/60 focus-visible:bg-background focus-visible:ring-3 focus-visible:ring-primary/15 dark:bg-secondary dark:focus-visible:bg-popover"
        />
      </form>

      {query && (
        <p role="status" className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>{counts[tab]} {counts[tab] === 1 ? "entry matches" : "entries match"} &ldquo;<span className="font-semibold text-foreground">{query}</span>&rdquo;</span>
          <Link href={journalHref({ tab, group, tag })} className="inline-flex items-center gap-1 text-xs font-semibold text-sage hover:underline"><X className="size-3.5" aria-hidden="true" /> Clear search</Link>
        </p>
      )}

      <nav aria-label="Filter entries" className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1">
        {JOURNAL_TABS.map((item) => {
          const active = tab === item.key;
          return (
            <Link
              key={item.key}
              href={journalHref({ q: query, tab: item.key, group, tag })}
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
          {shown.map(({ entry, pendingSync }) => {
            const position = positionLabel(entry);
            const kindLabel = entry.kind === "highlight" ? "highlight" : "note";
            const isEditing = editing?.id === entry.id;
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
                    {entry.group && (
                      <Link href={journalHref({ tab, tag, group: entry.group.id })} className="inline-flex max-w-full items-center gap-1 rounded-sm bg-secondary px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground">
                        <FolderOpen className="size-3 shrink-0" aria-hidden="true" /> <span className="truncate"><Highlighted text={entry.group.name} query={query} /></span>
                      </Link>
                    )}
                  </div>
                  {!isEditing && (
                    <div className="flex shrink-0 items-center">
                      <Button variant="ghost" size="icon-sm" aria-label={entry.book ? `Edit ${kindLabel} from ${entry.book.title}` : "Edit entry"} onClick={() => startEdit(entry)} className="text-muted-foreground"><Pencil className="size-3.5" /></Button>
                      <Button variant="ghost" size="icon-sm" aria-label={entry.book ? `Delete ${kindLabel} from ${entry.book.title}` : "Delete entry"} onClick={() => remove(entry.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="size-3.5" /></Button>
                    </div>
                  )}
                </div>
                <div className="space-y-3 px-5 py-4">
                  {entry.excerpt && (
                    <blockquote
                      className="rounded-r-md border-l-[3px] bg-card py-2.5 pr-3 pl-4 font-heading text-[17px] leading-7 text-muted-foreground italic dark:bg-background"
                      style={{ borderLeftColor: entry.kind === "highlight" ? highlightColor(isEditing && editing ? editing.color : entry.color).fill : "var(--sage)" }}
                    >
                      &ldquo;<Highlighted text={entry.excerpt} query={query} />&rdquo;
                    </blockquote>
                  )}
                  {isEditing && editing ? (
                    <form
                      className="space-y-3"
                      onSubmit={(event) => {
                        event.preventDefault();
                        saveEdit(entry);
                      }}
                    >
                      <label htmlFor={`edit-${entry.id}`} className="sr-only">{entry.kind === "highlight" ? "Your note on this highlight" : "Your entry"}</label>
                      <textarea
                        id={`edit-${entry.id}`}
                        autoFocus
                        value={editing.note}
                        onChange={(event) => setEditing({ ...editing, note: event.target.value })}
                        onKeyDown={(event) => event.key === "Escape" && setEditing(null)}
                        placeholder={entry.kind === "highlight" ? "Add a note to this highlight (optional)" : "What's on your mind?"}
                        maxLength={2000}
                        disabled={savingEdit}
                        className="field-sizing-content min-h-28 w-full resize-none rounded-lg border border-border bg-background px-4 py-3 font-heading text-[17px] leading-7 outline-none placeholder:text-muted-foreground focus-visible:border-sage/60 focus-visible:ring-3 focus-visible:ring-primary/15 dark:bg-well"
                      />
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <label htmlFor={`edit-group-${entry.id}`} className="meta flex items-center gap-1"><FolderOpen className="size-3" aria-hidden="true" /> Group</label>
                          <select
                            id={`edit-group-${entry.id}`}
                            value={editing.groupId}
                            onChange={(event) => setEditing({ ...editing, groupId: event.target.value })}
                            disabled={savingEdit}
                            className="h-8 max-w-48 min-w-0 rounded-lg border border-border bg-background px-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-primary/15 dark:bg-secondary"
                          >
                            <option value="">No group</option>
                            {groups.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                          </select>
                        </div>
                        {entry.kind === "highlight" && (
                          <div role="radiogroup" aria-label="Highlight colour" className="flex items-center gap-1.5">
                            <span className="meta" aria-hidden="true">Colour</span>
                            {HIGHLIGHT_COLORS.map((color) => (
                              <button
                                key={color.key}
                                type="button"
                                role="radio"
                                aria-checked={editing.color === color.key}
                                aria-label={color.label}
                                title={color.label}
                                disabled={savingEdit}
                                onClick={() => setEditing({ ...editing, color: color.key })}
                                className={cn("size-5 rounded-full border-2 transition-transform", editing.color === color.key ? "scale-110 border-foreground" : "border-transparent hover:scale-110")}
                                style={{ backgroundColor: color.fill }}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                      <TagInput tags={editing.tags} onChange={(tags) => setEditing({ ...editing, tags })} suggestions={tagSuggestions} disabled={savingEdit} />
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <div className="flex items-center gap-2">
                          <span className="meta">{editing.note.length} / 2,000</span>
                          <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(null)} disabled={savingEdit}><X /> Cancel</Button>
                          <Button type="submit" size="sm" disabled={savingEdit || (entry.kind === "note" && !editing.note.trim())}><Check /> {savingEdit ? "Saving…" : "Save changes"}</Button>
                        </div>
                      </div>
                    </form>
                  ) : (
                    <>
                      {entry.note && <p className="font-heading text-[17px] leading-7 break-words whitespace-pre-wrap"><Highlighted text={entry.note} query={query} /></p>}
                      {(entry.tags ?? []).length > 0 && (
                        <ul aria-label="Tags" className="flex flex-wrap gap-1.5">
                          {(entry.tags ?? []).map((item) => (
                            <li key={item}>
                              <Link
                                href={journalHref({ tab, group, tag: item })}
                                aria-current={item === tag ? "page" : undefined}
                                className={cn("inline-flex rounded-sm px-1.5 py-0.5 text-[11px] font-semibold transition-colors", item === tag ? "bg-primary text-primary-foreground" : "bg-secondary text-sage hover:text-foreground")}
                              >
                                <Highlighted text={`#${item}`} query={query} />
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  )}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-card px-5 py-2.5">
                  <time dateTime={entry.createdAt} className="meta flex items-center gap-1.5">
                    <Clock3 className="size-3" aria-hidden="true" /> {format(new Date(entry.createdAt), "MMM d, yyyy · h:mm a")}
                    {pendingSync ? (
                      <span role="status" className="text-amber">· edit saved on this device, will sync when you&rsquo;re back online</span>
                    ) : (
                      entry.editedAt && <span title={`Edited ${format(new Date(entry.editedAt), "MMM d, yyyy · h:mm a")}`}>· edited</span>
                    )}
                  </time>
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

      {pagination.pages > 1 && (
        <nav aria-label="Journal pages" className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <p className="meta">
            Showing {pagination.from}–{pagination.to} of {pagination.total} {pagination.total === 1 ? "entry" : "entries"}
          </p>
          <div className="flex items-center gap-2">
            {pagination.page > 1 ? (
              <Link href={journalHref({ q: query, tab, group, tag, page: pagination.page - 1 })} rel="prev" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-semibold transition-colors hover:bg-secondary">
                <ArrowLeft className="size-3.5" aria-hidden="true" /> Previous
              </Link>
            ) : (
              <span aria-disabled="true" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold text-muted-foreground/60">
                <ArrowLeft className="size-3.5" aria-hidden="true" /> Previous
              </span>
            )}
            <span className="meta px-1" aria-current="page">Page {pagination.page} of {pagination.pages}</span>
            {pagination.page < pagination.pages ? (
              <Link href={journalHref({ q: query, tab, group, tag, page: pagination.page + 1 })} rel="next" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-semibold transition-colors hover:bg-secondary">
                Next <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            ) : (
              <span aria-disabled="true" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold text-muted-foreground/60">
                Next <ArrowRight className="size-3.5" aria-hidden="true" />
              </span>
            )}
          </div>
        </nav>
      )}
    </div>
  );
}
