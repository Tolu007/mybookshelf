// Journal filtering: tabs, search and URLs. Shared by the journal page
// (which filters on the server) and the tests.

export type JournalEntry = {
  id: string;
  kind: "note" | "highlight";
  note: string | null;
  excerpt: string | null;
  location: string | null;
  createdAt: string;
  book: { id: string; title: string; format: string } | null;
};

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
  return [entry.note, entry.excerpt, entry.book?.title].some((text) => text?.toLowerCase().includes(needle));
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

export function journalHref({ q, tab }: { q?: string; tab?: JournalTab }) {
  const search = new URLSearchParams();
  if (q?.trim()) search.set("q", q.trim());
  if (tab && tab !== "all") search.set("tab", tab);
  const query = search.toString();
  return query ? `/journal?${query}` : "/journal";
}
