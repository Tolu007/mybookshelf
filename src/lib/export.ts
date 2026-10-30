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

// A readable version: your journal, then each book with its highlights,
// notes and reading time.
export function buildExportMarkdown(data: LibraryExport) {
  const lines: string[] = [`# Shelf export`, ``, `Exported ${format(new Date(data.exported_at), "MMMM d, yyyy 'at' h:mm a")}.`, ``];

  const standalone = data.annotations.filter((entry) => entry.type === "note" && !entry.book_id);
  if (standalone.length) {
    lines.push(`## Journal`, ``);
    for (const entry of standalone) {
      lines.push(`### ${when(entry.created_at)}`, ``, entry.note ?? "", ``);
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
      for (const entry of highlights) lines.push(quote(entry.excerpt!), ``);
    }
    const notes = own.filter((entry) => entry.type === "note" && entry.note);
    if (notes.length) {
      lines.push(`#### Notes`, ``);
      for (const entry of notes) lines.push(`- ${when(entry.created_at)}: ${entry.note!.replace(/\n+/g, " ")}`);
      lines.push(``);
    }
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}
