// Journal filtering: tabs, search, pages and URLs. Shared by the journal page
// (which filters on the server) and the tests.

export const JOURNAL_PAGE_SIZE = 20;

export type JournalEntry = {
  id: string;
  kind: "note" | "highlight";
  note: string | null;
  excerpt: string | null;
  location: string | null;
  createdAt: string;
  editedAt?: string | null;
  book: { id: string; title: string; format: string } | null;
  group?: JournalGroup | null;
  tags?: string[];
  color?: string | null;
};

export type JournalGroup = { id: string; name: string };

export const MAX_TAGS = 10;
export const TAG_MAX_LENGTH = 30;

// "#Stoic Ethics " -> "stoic-ethics". Letters, numbers, "-" and "_" only.
export function normalizeTag(value: string) {
  return value
    .trim()
    .replace(/^#+/, "")
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}_-]/gu, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, TAG_MAX_LENGTH);
}

// A submitted tag list: normalized, de-duplicated, capped. Null when it isn't
// a list at all.
export function parseTags(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const tags = value.filter((tag): tag is string => typeof tag === "string").map(normalizeTag).filter(Boolean);
  return [...new Set(tags)].slice(0, MAX_TAGS);
}

// Every tag in use, most used first, then alphabetically.
export function tagCounts(entries: JournalEntry[]) {
  const counts = new Map<string, number>();
  for (const entry of entries) for (const tag of entry.tags ?? []) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  return [...counts].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

export function hasTag(entry: JournalEntry, tag: string | undefined) {
  return !tag || (entry.tags ?? []).includes(tag);
}

// "ungrouped" is a pseudo-group for entries not filed anywhere.
export const UNGROUPED = "ungrouped";

export function inGroup(entry: JournalEntry, group: string | undefined) {
  if (!group) return true;
  if (group === UNGROUPED) return !entry.group;
  return entry.group?.id === group;
}

export const JOURNAL_TABS = [
  { key: "all", label: "All entries" },
  { key: "in_book", label: "In-book notes" },
  { key: "standalone", label: "Standalone" },
  { key: "highlights", label: "Highlights" },
] as const;

export type JournalTab = (typeof JOURNAL_TABS)[number]["key"];

export function parseTab(value: string | undefined): JournalTab {
  return JOURNAL_TABS.some((tab) => tab.key === value) ? (value as JournalTab) : "all";
}

export function inTab(entry: JournalEntry, tab: JournalTab) {
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

// Case-insensitive match on the note, the highlighted passage, or the book.
export function matchesQuery(entry: JournalEntry, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [entry.note, entry.excerpt, entry.book?.title, entry.group?.name, ...(entry.tags ?? []).map((tag) => `#${tag}`)].some((text) => text?.toLowerCase().includes(needle));
}

// Splits text around case-insensitive matches of the query: odd-numbered
// parts are the matches.
export function splitOnMatches(text: string, query: string) {
  const needle = query.trim();
  if (!needle) return [text];
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.split(new RegExp(`(${escaped})`, "gi"));
}

export function tabCounts(entries: JournalEntry[]) {
  return Object.fromEntries(JOURNAL_TABS.map((tab) => [tab.key, entries.filter((entry) => inTab(entry, tab.key)).length])) as Record<JournalTab, number>;
}

export type JournalPage = { page: number; pages: number; total: number; from: number; to: number };

// The requested page of entries, clamped to the pages that exist.
export function paginate<T>(items: T[], requested: string | number | undefined, pageSize = JOURNAL_PAGE_SIZE) {
  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  const asked = Math.floor(Number(requested));
  const page = Number.isFinite(asked) ? Math.min(pages, Math.max(1, asked)) : 1;
  const start = (page - 1) * pageSize;
  const slice = items.slice(start, start + pageSize);
  return {
    items: slice,
    pagination: { page, pages, total: items.length, from: slice.length ? start + 1 : 0, to: start + slice.length } satisfies JournalPage,
  };
}

export function journalHref({ q, tab, page, group, tag }: { q?: string; tab?: JournalTab; page?: number; group?: string; tag?: string }) {
  const search = new URLSearchParams();
  if (q?.trim()) search.set("q", q.trim());
  if (tab && tab !== "all") search.set("tab", tab);
  if (group) search.set("group", group);
  if (tag) search.set("tag", tag);
  if (page && page > 1) search.set("page", String(page));
  const query = search.toString();
  return query ? `/journal?${query}` : "/journal";
}
