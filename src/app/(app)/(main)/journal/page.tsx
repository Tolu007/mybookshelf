import { createClient } from "@/lib/supabase/server";
import { JournalList } from "@/components/journal/journal-list";
import { NewNoteDialog } from "@/components/journal/new-note-dialog";

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
    <div className="mx-auto max-w-3xl space-y-8 px-6 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl">Journal</h1>
          <p className="text-muted-foreground">
            Every note you've written across your books, in one place.
          </p>
        </div>
        <NewNoteDialog booksInProgress={booksInProgress} />
      </div>

      <JournalList initialNotes={journalNotes} />
    </div>
  );
}
