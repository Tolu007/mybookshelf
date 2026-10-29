import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parsePreferences } from "@/lib/preferences";

export async function PUT(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body.preferences !== "object") {
    return NextResponse.json({ error: "Preferences are required." }, { status: 400 });
  }

  // Normalise before storing so only known, in-range values are saved.
  const preferences = parsePreferences(body.preferences);
  const { error } = await supabase
    .from("user_preferences")
    .upsert({ user_id: user.id, preferences, updated_at: new Date().toISOString() });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ preferences });
}
