import type { createClient } from "@/lib/supabase/server";
import { parsePreferences, type Preferences } from "@/lib/preferences";

// Falls back to defaults when there's no saved row yet, or when the
// user_preferences table hasn't been created (schema.sql not re-run).
export async function loadPreferences(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<Preferences> {
  const { data } = await supabase
    .from("user_preferences")
    .select("preferences")
    .eq("user_id", userId)
    .maybeSingle();
  return parsePreferences(data?.preferences);
}
