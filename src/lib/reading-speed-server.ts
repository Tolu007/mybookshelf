import type { createClient } from "@/lib/supabase/server";
import { wordsPerMinute } from "@/lib/reading-speed";
import { fetchAll } from "@/lib/supabase/fetch-all";

// Average words per minute across measured sessions, optionally from a
// date (yyyy-MM-dd) onwards. Null when nothing has been measured yet, or
// before the speed columns exist (schema.sql not re-run).
export async function loadAverageWpm(
  supabase: Awaited<ReturnType<typeof createClient>>,
  range: { from?: string; to?: string } = {}
) {
  const { data, error } = await fetchAll<{ words_read: number | null; word_seconds: number | null }>((from, to) => {
    let query = supabase.from("reading_sessions").select("id, words_read, word_seconds").gt("word_seconds", 0).order("id");
    if (range.from) query = query.gte("local_date", range.from);
    if (range.to) query = query.lte("local_date", range.to);
    return query.range(from, to);
  });
  if (error) return null;
  const words = data.reduce((sum, row) => sum + (row.words_read ?? 0), 0);
  const seconds = data.reduce((sum, row) => sum + (row.word_seconds ?? 0), 0);
  return wordsPerMinute(words, seconds);
}
