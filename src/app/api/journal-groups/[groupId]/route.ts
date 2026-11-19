import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseGroupName } from "@/lib/journal-groups";

type Params = { params: Promise<{ groupId: string }> };

// Rename a group.
export async function PATCH(request: Request, { params }: Params) {
  const { groupId } = await params;
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
    .update({ name })
    .eq("id", groupId)
    .eq("user_id", user.id)
    .select("id, name")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Group not found." }, { status: 404 });
  }

  return NextResponse.json({ group: data });
}

// Delete a group. Its entries stay in the journal, ungrouped.
export async function DELETE(_request: Request, { params }: Params) {
  const { groupId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabase
    .from("journal_groups")
    .delete()
    .eq("id", groupId)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
