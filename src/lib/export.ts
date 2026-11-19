import { format } from "date-fns";
import { formatMinutes } from "@/lib/stats-aggregate";

// Everything Shelf stores about your library, for the Settings export.
// Book files aren't included: they already live in your Google Drive.

export type ExportBook = {
  id: string;
  title: string;
  author: string | null;
  format: string;
  category: string | null;
  added_at: string;
  finished_at: string | null;
  want_to_read: boolean;
  is_favorite: boolean;
  progress_percent: number | null;
};

export type ExportAnnotation = {
  id: string;
  type: "note" | "highlight" | "bookmark";
  book_id: string | null;
  location: string | null;
  excerpt: string | null;
  note: string | null;
  created_at: string;
  edited_at?: string | null;
  group_id?: string | null;
  // Highlights only; null is the original amber.
  color?: string | null;
  tags?: string[];
};

export type ExportJournalGroup = {
  id: string;
  name: string;
  created_at: string;
};

export type ExportSession = {
  book_id: string;
  started_at: string;
  ended_at: string;
  duration_seconds: number;
  local_date: string;
};

export type LibraryExport = {
  exported_at: string;
  note: string;
  books: ExportBook[];
  annotations: ExportAnnotation[];
  journal_groups?: ExportJournalGroup[];
  reading_sessions: ExportSession[];
  stats: Record<string, unknown> | null;
  preferences: unknown;
};

export function exportFileName(extension: "json" | "md", date = new Date()) {
  return `shelf-export-${format(date, "yyyy-MM-dd")}.${extension}`;
}

function quote(text: string) {
  return text.split("\n").map((line) => `> ${line}`).join("\n");
}

function when(iso: string) {
  return format(new Date(iso), "MMM d, yyyy");
}

// "#stoic #mornings", or nothing when an entry has no tags.
function tagLine(entry: ExportAnnotation) {
  return (entry.tags ?? []).map((tag) => `#${tag}`).join(" ");
}

function entryHeading(entry: ExportAnnotation) {
  return entry.edited_at ? `${when(entry.created_at)} (edited ${when(entry.edited_at)})` : when(entry.created_at);
}

// A readable version: your journal, then each book with its highlights,
// notes and reading time.
export function buildExportMarkdown(data: LibraryExport) {
  const lines: string[] = [`# Shelf export`, ``, `Exported ${format(new Date(data.exported_at), "MMMM d, yyyy 'at' h:mm a")}.`, ``];

  const groups = data.journal_groups ?? [];
  const groupIds = new Set(groups.map((group) => group.id));
  const grouped = (entry: ExportAnnotation) => !!entry.group_id && groupIds.has(entry.group_id);
  const bookTitle = new Map(data.books.map((book) => [book.id, book.title]));

  // Ungrouped reflections written outside any book.
  const standalone = data.annotations.filter((entry) => entry.type === "note" && !entry.book_id && !grouped(entry));
  if (standalone.length) {
    lines.push(`## Journal`, ``);
    for (const entry of standalone) {
      lines.push(`### ${entryHeading(entry)}`, ``, entry.note ?? "", ``);
      if (tagLine(entry)) lines.push(tagLine(entry), ``);
    }
  }

  // Each group with everything filed in it: reflections, book notes and
  // highlights. Book entries also appear under their book below.
  if (groups.length) {
    lines.push(`## Journal groups`, ``);
    for (const group of [...groups].sort((a, b) => a.name.localeCompare(b.name))) {
      const own = data.annotations.filter((entry) => entry.group_id === group.id && entry.type !== "bookmark");
      lines.push(`### ${group.name}`, ``);
      if (own.length === 0) lines.push(`No entries yet.`, ``);
      for (const entry of own) {
        const title = entry.book_id ? bookTitle.get(entry.book_id) : undefined;
        lines.push(`#### ${entryHeading(entry)}${title ? ` · ${title}` : ""}`, ``);
        if (entry.excerpt) lines.push(quote(entry.excerpt), ``);
        if (entry.note) lines.push(entry.note, ``);
        if (tagLine(entry)) lines.push(tagLine(entry), ``);
      }
    }
  }

  lines.push(`## Books`, ``);
  if (data.books.length === 0) lines.push(`No books yet.`, ``);
  for (const book of data.books) {
    const own = data.annotations.filter((entry) => entry.book_id === book.id);
    const minutes = data.reading_sessions.filter((session) => session.book_id === book.id).reduce((sum, session) => sum + session.duration_seconds, 0) / 60;
    const status = book.finished_at
      ? `Finished ${when(book.finished_at)}`
      : book.progress_percent !== null
        ? `${Math.round(book.progress_percent)}% read`
        : book.want_to_read
          ? "Want to read"
          : "Not started";
    const details = [book.author, book.category, book.format.toUpperCase(), status, minutes > 0 ? `${formatMinutes(minutes)} reading` : null, book.is_favorite ? "Favorite" : null].filter(Boolean);

    lines.push(`### ${book.title}`, ``, details.join(" · "), ``);
    const highlights = own.filter((entry) => entry.type === "highlight" && entry.excerpt);
    if (highlights.length) {
      lines.push(`#### Highlights`, ``);
      for (const entry of highlights) {
        lines.push(quote(entry.excerpt!), ``);
        if (entry.note) lines.push(entry.note, ``);
        if (tagLine(entry)) lines.push(tagLine(entry), ``);
      }
    }
    const notes = own.filter((entry) => entry.type === "note" && entry.note);
    if (notes.length) {
      lines.push(`#### Notes`, ``);
      for (const entry of notes) {
        const tags = tagLine(entry);
        lines.push(`- ${when(entry.created_at)}: ${entry.note!.replace(/\n+/g, " ")}${tags ? ` ${tags}` : ""}`);
      }
      lines.push(``);
    }
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}
