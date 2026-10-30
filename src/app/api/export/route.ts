import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { buildExportMarkdown, exportFileName, type ExportAnnotation, type ExportSession, type LibraryExport } from "@/lib/export";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const asMarkdown = new URL(request.url).searchParams.get("format") === "markdown";

  const [books, categories, progress, annotations, sessions, stats, preferences] = await Promise.all([
    fetchAll<{ id: string; title: string; author: string | null; format: string; category_id: string | null; added_at: string; finished_at: string | null; want_to_read: boolean; is_favorite: boolean }>((from, to) =>
      supabase.from("books").select("id, title, author, format, category_id, added_at, finished_at, want_to_read, is_favorite").order("added_at").order("id").range(from, to)
    ),
    supabase.from("categories").select("id, name"),
    fetchAll<{ book_id: string; percent: number }>((from, to) =>
      supabase.from("reading_progress").select("book_id, percent").order("book_id").range(from, to)
    ),
    fetchAll<ExportAnnotation>((from, to) =>
      supabase.from("annotations").select("id, type, book_id, location, excerpt, note, created_at").order("created_at").order("id").range(from, to)
    ),
    fetchAll<ExportSession>((from, to) =>
      supabase.from("reading_sessions").select("book_id, started_at, ended_at, duration_seconds, local_date").order("started_at").order("id").range(from, to)
    ),
    supabase.from("user_stats").select("current_streak, longest_streak, last_read_date, books_finished").eq("user_id", user.id).maybeSingle(),
    supabase.from("user_preferences").select("preferences").eq("user_id", user.id).maybeSingle(),
  ]);

  const failed = [books, progress, annotations, sessions].find((result) => result.error);
  if (failed) {
    return NextResponse.json({ error: "Your library couldn't be exported. Please try again." }, { status: 500 });
  }

  const categoryName = new Map((categories.data ?? []).map((category) => [category.id, category.name]));
  const percentByBook = new Map(progress.data.map((row) => [row.book_id, Number(row.percent)]));

  const data: LibraryExport = {
    exported_at: new Date().toISOString(),
    note: "Book files aren't included; they're in the \"Shelf Library\" folder of your Google Drive.",
    books: books.data.map((book) => ({
      id: book.id,
      title: book.title,
      author: book.author,
      format: book.format,
      category: book.category_id ? categoryName.get(book.category_id) ?? null : null,
      added_at: book.added_at,
      finished_at: book.finished_at,
      want_to_read: book.want_to_read,
      is_favorite: book.is_favorite,
      progress_percent: percentByBook.get(book.id) ?? null,
    })),
    annotations: annotations.data,
    reading_sessions: sessions.data,
    stats: stats.data ?? null,
    preferences: preferences.data?.preferences ?? null,
  };

  const body = asMarkdown ? buildExportMarkdown(data) : JSON.stringify(data, null, 2);
  return new NextResponse(body, {
    headers: {
      "Content-Type": asMarkdown ? "text/markdown; charset=utf-8" : "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportFileName(asMarkdown ? "md" : "json")}"`,
      "Cache-Control": "no-store",
    },
  });
}
