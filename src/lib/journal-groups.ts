import type { SupabaseClient } from "@supabase/supabase-js";

export const GROUP_NAME_MAX = 60;

// Trims a submitted group name; null when it's missing or blank.
export function parseGroupName(value: unknown) {
  const name = typeof value === "string" ? value.trim().slice(0, GROUP_NAME_MAX) : "";
  return name || null;
}

// A submitted group id, checked against the user's own groups (RLS hides
// everyone else's). Returns undefined when the field wasn't sent, null to
// ungroup, the id when it's valid, or false when it isn't one of theirs.
export async function resolveGroupId(supabase: SupabaseClient, value: unknown): Promise<string | null | undefined | false> {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string") return false;
  const { data } = await supabase.from("journal_groups").select("id").eq("id", value).maybeSingle();
  return data ? data.id : false;
}
