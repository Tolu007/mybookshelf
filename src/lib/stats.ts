import type { SupabaseClient } from "@supabase/supabase-js";

const MIN_SESSION_SECONDS = 30;

function shiftDate(dateStr: string, days: number) {
  const date = new Date(`${dateStr}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export async function recordReadingSession(
  supabase: SupabaseClient,
  userId: string,
  params: {
    bookId: string;
    startedAt: string;
    endedAt: string;
    durationSeconds: number;
    localDate: string;
  }
) {
  if (params.durationSeconds < MIN_SESSION_SECONDS) return;

  const { error: sessionError } = await supabase.from("reading_sessions").insert({
    user_id: userId,
    book_id: params.bookId,
    started_at: params.startedAt,
    ended_at: params.endedAt,
    duration_seconds: Math.round(params.durationSeconds),
    local_date: params.localDate,
  });
  if (sessionError) throw sessionError;

  const { data: stats, error: statsError } = await supabase
    .from("user_stats")
    .select("current_streak, longest_streak, last_read_date")
    .eq("user_id", userId)
    .single();
  if (statsError) throw statsError;

  const today = params.localDate;
  if (stats.last_read_date === today) return;

  const wasYesterday = stats.last_read_date === shiftDate(today, -1);
  const nextStreak = wasYesterday ? stats.current_streak + 1 : 1;

  const { error: updateError } = await supabase
    .from("user_stats")
    .update({
      current_streak: nextStreak,
      longest_streak: Math.max(stats.longest_streak, nextStreak),
      last_read_date: today,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
  if (updateError) throw updateError;
}

export async function markBookFinished(
  supabase: SupabaseClient,
  userId: string,
  bookId: string
) {
  const { data: book, error: fetchError } = await supabase
    .from("books")
    .select("finished_at")
    .eq("id", bookId)
    .eq("user_id", userId)
    .single();
  if (fetchError) throw fetchError;
  if (book.finished_at) return;

  const { error: bookError } = await supabase
    .from("books")
    .update({ finished_at: new Date().toISOString() })
    .eq("id", bookId)
    .eq("user_id", userId);
  if (bookError) throw bookError;

  const { error: rpcError } = await supabase.rpc("increment_books_finished", {
    target_user_id: userId,
  });
  if (rpcError) throw rpcError;
}
