import { createClient } from "@/lib/supabase/server";
import { JournalList } from "@/components/journal/journal-list";
import { NewNoteDialog } from "@/components/journal/new-note-dialog";
import { PageHeader } from "@/components/page-header";
import { NotebookPen } from "lucide-react";

type NoteRow = {
  id: string;
  location: string;
  note: string | null;
  created_at: string;
  book: { id: string; title: string; cover_url: string | null } | null;
};

type ProgressRow = {
  location: string | null;
  book: { id: string; title: string } | null;
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

  const { data: inProgress } = await supabase
    .from("reading_progress")
    .select("location, book:books(id, title)")
    .not("location", "is", null);

  const booksInProgress = ((inProgress ?? []) as unknown as ProgressRow[])
    .filter(
      (row): row is ProgressRow & { book: NonNullable<ProgressRow["book"]>; location: string } =>
        Boolean(row.book) && Boolean(row.location)
    )
    .map((row) => ({ id: row.book.id, title: row.book.title, location: row.location }));

  const journalNotes = ((notes ?? []) as unknown as NoteRow[])
    .filter((row): row is NoteRow & { book: NonNullable<NoteRow["book"]> } => Boolean(row.book))
    .map((row) => ({
      id: row.id,
      note: row.note ?? "",
      location: row.location,
      createdAt: row.created_at,
      book: { id: row.book.id, title: row.book.title, coverUrl: row.book.cover_url },
    }));

  return (
    <div className="page-shell space-y-8">
      <PageHeader eyebrow="Thoughts from the margins" title="Between the lines." description="The ideas that linger. The questions that matter. Your reading, in your own words." action={<NewNoteDialog booksInProgress={booksInProgress} />} />
      <div className="flex items-center justify-between border-b border-border pb-4"><h2 className="flex items-center gap-2 text-xs font-medium"><NotebookPen className="size-3.5 text-primary" aria-hidden="true" /> Your notes <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{journalNotes.length}</span></h2><span className="text-[10px] text-muted-foreground">Most recent first</span></div>
      <JournalList initialNotes={journalNotes} />
    </div>
  );
}
