import { createClient } from "@/lib/supabase/server";
import { JournalList } from "@/components/journal/journal-list";
import { NewNoteDialog } from "@/components/journal/new-note-dialog";
import { PageHeader } from "@/components/page-header";
import { NotebookPen } from "lucide-react";

type NoteRow = {
  id: string;
  location: string | null;
  note: string | null;
  created_at: string;
  book: { id: string; title: string; cover_url: string | null } | null;
};

export default async function JournalPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: notes } = await supabase
    .from("annotations")
    .select("id, location, note, created_at, book:books(id, title, cover_url)")
    .eq("type", "note")
    .order("created_at", { ascending: false });

  const [{ data: allBooks }, { data: progress }] = await Promise.all([
    supabase.from("books").select("id, title").order("title"),
    supabase.from("reading_progress").select("book_id, location"),
  ]);

  const locationByBook = new Map((progress ?? []).map((row) => [row.book_id, row.location as string | null]));
  const books = (allBooks ?? []).map((book) => ({
    id: book.id,
    title: book.title,
    location: locationByBook.get(book.id) ?? null,
  }));

  // A note's book is optional: entries written outside a book have none.
  const journalNotes = ((notes ?? []) as unknown as NoteRow[]).map((row) => ({
    id: row.id,
    note: row.note ?? "",
    location: row.location,
    createdAt: row.created_at,
    book: row.book ? { id: row.book.id, title: row.book.title, coverUrl: row.book.cover_url } : null,
  }));

  return (
    <div className="page-shell space-y-8">
      <PageHeader eyebrow="Your journal" title="Between the lines." description="The ideas that linger. The questions that matter. Write about a book, or about anything at all." action={<NewNoteDialog books={books} />} />
      <div className="flex items-center justify-between border-b border-border pb-4"><h2 className="flex items-center gap-2 text-xs font-medium"><NotebookPen className="size-3.5 text-primary" aria-hidden="true" /> Your entries <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{journalNotes.length}</span></h2><span className="text-[10px] text-muted-foreground">Most recent first</span></div>
      <JournalList initialNotes={journalNotes} />
    </div>
  );
}
