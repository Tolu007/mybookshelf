import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseGroupName } from "@/lib/journal-groups";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const name = parseGroupName(body?.name);
  if (!name) {
    return NextResponse.json({ error: "A group name is required." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("journal_groups")
    .insert({ user_id: user.id, name })
    .select("id, name")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ group: data }, { status: 201 });
}
