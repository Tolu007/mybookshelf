import { notFound } from "next/navigation";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { loadPreferences } from "@/lib/preferences-server";
import { PdfReader } from "@/components/readers/pdf-reader";
import { EpubReader } from "@/components/readers/epub-reader";

export default async function ReadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ location?: string }>;
}) {
  const { id } = await params;
  const { location: jumpToLocation } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) notFound();

  const { data: book } = await supabase
    .from("books")
    .select("id, title, format, finished_at")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!book) notFound();

  const [{ data: progress }, preferences, { data: todaySessions }] = await Promise.all([
    supabase.from("reading_progress").select("location").eq("book_id", id).maybeSingle(),
    loadPreferences(supabase, user.id),
    supabase.from("reading_sessions").select("duration_seconds").eq("local_date", format(new Date(), "yyyy-MM-dd")),
  ]);

  const sharedProps = {
    bookId: book.id,
    title: book.title,
    // A note's own location (from the journal) takes priority over wherever
    // you last left off reading — you're jumping there on purpose.
    initialLocation: jumpToLocation ?? progress?.location ?? null,
    isFinished: Boolean(book.finished_at),
    dailyGoalMinutes: preferences.goals.dailyMinutes,
    minutesBeforeSession: (todaySessions ?? []).reduce((sum, row) => sum + row.duration_seconds, 0) / 60,
  };

  return book.format === "pdf" ? (
    <PdfReader {...sharedProps} />
  ) : (
    <EpubReader {...sharedProps} typography={preferences.reader} />
  );
}
