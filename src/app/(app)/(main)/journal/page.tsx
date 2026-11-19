import Link from "next/link";
import { Hash, LibraryBig, X } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { JournalList } from "@/components/journal/journal-list";
import { hasTag, inGroup, inTab, journalHref, matchesQuery, paginate, parseTab, tabCounts, tagCounts, UNGROUPED, type JournalEntry, type JournalGroup } from "@/lib/journal";
import { cn } from "@/lib/utils";
import { JournalGroups } from "@/components/journal/journal-groups";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { JournalComposer } from "@/components/journal/journal-composer";
import { PageHeader } from "@/components/page-header";

type EntryRow = {
  id: string;
  type: "note" | "highlight";
  location: string | null;
  note: string | null;
  excerpt: string | null;
  created_at: string;
  edited_at: string | null;
  book: { id: string; title: string; format: string } | null;
  group: { id: string; name: string } | null;
  tags: string[] | null;
  color: string | null;
};

const INDEXED_VOLUMES = 6;

export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tab?: string; page?: string; group?: string; tag?: string }>;
}) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const tab = parseTab(params.tab);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [{ data: rows }, { data: allBooks }, { data: progress }, { data: groupRows }] = await Promise.all([
    fetchAll<EntryRow>((from, to) =>
      supabase
        .from("annotations")
        .select("id, type, location, note, excerpt, created_at, edited_at, tags, color, book:books(id, title, format), group:journal_groups(id, name)")
        .in("type", ["note", "highlight"])
        .order("created_at", { ascending: false })
        .order("id")
        .range(from, to) as unknown as PromiseLike<{ data: EntryRow[] | null; error: unknown }>
    ),
    supabase.from("books").select("id, title, author").order("title"),
    supabase.from("reading_progress").select("book_id, location"),
    supabase.from("journal_groups").select("id, name").order("name"),
  ]);

  const groups: JournalGroup[] = groupRows ?? [];
  // An unknown group in the URL (e.g. one just deleted) falls back to all.
  const group = params.group === UNGROUPED || groups.some((item) => item.id === params.group) ? params.group : undefined;

  const locationByBook = new Map((progress ?? []).map((row) => [row.book_id, row.location as string | null]));
  const books = (allBooks ?? []).map((book) => ({
    id: book.id,
    title: book.title,
    location: locationByBook.get(book.id) ?? null,
  }));

  // A note's book is optional: entries written outside a book have none.
  const entries: JournalEntry[] = rows.map((row) => ({
    id: row.id,
    kind: row.type,
    note: row.note,
    excerpt: row.excerpt,
    location: row.location,
    createdAt: row.created_at,
    editedAt: row.edited_at,
    book: row.book,
    group: row.group,
    tags: row.tags ?? [],
    color: row.color,
  }));

  const allTags = tagCounts(entries);
  // Only a tag that's actually in use filters the list.
  const tag = allTags.some((item) => item.tag === params.tag) ? params.tag : undefined;

  const groupCounts: Record<string, number> = { [UNGROUPED]: 0 };
  for (const entry of entries) {
    const key = entry.group?.id ?? UNGROUPED;
    groupCounts[key] = (groupCounts[key] ?? 0) + 1;
  }

  // Books ranked by how much you've written in them.
  const entryCounts = new Map<string, number>();
  for (const entry of entries) {
    if (entry.book) entryCounts.set(entry.book.id, (entryCounts.get(entry.book.id) ?? 0) + 1);
  }
  // Search applies before tab counts, so each tab shows how many match.
  const matching = entries.filter((entry) => inGroup(entry, group) && hasTag(entry, tag) && matchesQuery(entry, query));
  const counts = tabCounts(matching);
  const { items: shown, pagination } = paginate(matching.filter((entry) => inTab(entry, tab)), params.page);

  const indexed = (allBooks ?? [])
    .filter((book) => entryCounts.has(book.id))
    .sort((a, b) => (entryCounts.get(b.id) ?? 0) - (entryCounts.get(a.id) ?? 0))
    .slice(0, INDEXED_VOLUMES);

  return (
    <div className="page-shell space-y-8">
      <PageHeader
        eyebrow={<><span>Journal</span><span className="text-muted-foreground" aria-hidden="true">•</span><span className="text-muted-foreground">{entries.length} {entries.length === 1 ? "entry" : "entries"}</span></>}
        title="Journal & marginalia"
        description="Reflections, notes and highlights from your reading life, or about anything at all."
      />

      <JournalComposer key={`${group ?? "all"}:${tag ?? ""}`} books={books} groups={groups} defaultGroupId={group && group !== UNGROUPED ? group : ""} defaultTags={tag ? [tag] : []} tagSuggestions={allTags.map((item) => item.tag)} />

      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <JournalGroups groups={groups} counts={groupCounts} total={entries.length} active={group} query={query} tab={tab} tag={tag} />
          <section aria-labelledby="tags-heading" className="surface p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 id="tags-heading" className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
                <Hash className="size-3.5" aria-hidden="true" /> Tags
              </h2>
              {tag && (
                <Link href={journalHref({ q: query, tab, group })} className="inline-flex items-center gap-1 text-[11px] font-semibold text-sage hover:underline">
                  <X className="size-3" aria-hidden="true" /> Clear
                </Link>
              )}
            </div>
            {allTags.length === 0 ? (
              <p className="text-xs leading-relaxed text-muted-foreground">Add tags to entries to see them here.</p>
            ) : (
              <ul className="flex flex-wrap gap-1.5">
                {allTags.map((item) => {
                  const active = item.tag === tag;
                  return (
                    <li key={item.tag}>
                      <Link
                        href={journalHref({ q: query, tab, group, tag: active ? undefined : item.tag })}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[11px] font-semibold transition-colors",
                          active ? "border-primary/30 bg-primary text-primary-foreground" : "border-border bg-secondary text-sage hover:border-sage/40"
                        )}
                      >
                        #{item.tag}
                        <span className={cn("tabular-nums", active ? "opacity-80" : "text-muted-foreground")}>{item.count}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
          <section aria-labelledby="indexed-heading" className="surface p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 id="indexed-heading" className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
                <LibraryBig className="size-3.5" aria-hidden="true" /> Indexed volumes
              </h2>
              <span className="meta">{entryCounts.size} {entryCounts.size === 1 ? "source" : "sources"}</span>
            </div>
            {indexed.length === 0 ? (
              <p className="text-xs leading-relaxed text-muted-foreground">Books you write about will be listed here.</p>
            ) : (
              <ul className="space-y-1.5">
                {indexed.map((book, index) => (
                  <li key={book.id}>
                    <Link href={`/read/${book.id}`} className="flex items-center gap-3 rounded-md border border-border bg-background px-3 py-2 transition-colors hover:border-sage/40 dark:bg-secondary">
                      <span className={index % 3 === 1 ? "h-8 w-1 shrink-0 rounded-full bg-ribbon" : "h-8 w-1 shrink-0 rounded-full bg-primary"} aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-heading text-sm leading-5 font-semibold">{book.title}</span>
                        <span className="block truncate text-[11px] text-muted-foreground">{book.author ?? "Unknown author"}</span>
                      </span>
                      <span className="rounded-sm bg-secondary px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground tabular-nums dark:bg-popover">{entryCounts.get(book.id)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>

        <JournalList entries={shown} counts={counts} tab={tab} query={query} pagination={pagination} groups={groups} group={group} tag={tag} tagSuggestions={allTags.map((item) => item.tag)} />
      </div>
    </div>
  );
}
