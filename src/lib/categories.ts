import type { SupabaseClient } from "@supabase/supabase-js";

export async function resolveCategoryId(
  supabase: SupabaseClient,
  userId: string,
  name: string
) {
  const { data: existing } = await supabase
    .from("categories")
    .select("id")
    .eq("user_id", userId)
    .ilike("name", name)
    .maybeSingle();

  if (existing) return existing.id as string;

  const { data: created, error } = await supabase
    .from("categories")
    .insert({ user_id: userId, name })
    .select("id")
    .single();

  if (error) throw error;
  return created.id as string;
}
