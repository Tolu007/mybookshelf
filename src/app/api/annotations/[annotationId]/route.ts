import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveGroupId } from "@/lib/journal-groups";
import { parseTags } from "@/lib/journal";
import { isHighlightColor } from "@/lib/highlight-colors";

// Edit a journal entry: its note text, group, tags, and (for highlights)
// colour. Notes need text; a highlight's note is optional, so it can be
// cleared. Fields left out of the body are left as they are.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ annotationId: string }> }
) {
  const { annotationId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const { data: existing } = await supabase
    .from("annotations")
    .select("id, type, note")
    .eq("id", annotationId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "Entry not found." }, { status: 404 });
  }

  const changes: Record<string, unknown> = {};

  if (body?.note !== undefined) {
    if (typeof body.note !== "string") {
      return NextResponse.json({ error: "The note must be text." }, { status: 400 });
    }
    const note = body.note.trim().slice(0, 2000);
    if (!note && existing.type === "note") {
      return NextResponse.json({ error: "A note is required." }, { status: 400 });
    }
    if ((note || null) !== existing.note) {
      changes.note = note || null;
      changes.edited_at = new Date().toISOString();
    }
  }

  const groupId = await resolveGroupId(supabase, body?.groupId);
  if (groupId === false) {
    return NextResponse.json({ error: "That journal group doesn't exist." }, { status: 400 });
  }
  if (groupId !== undefined) changes.group_id = groupId;

  if (body?.tags !== undefined) {
    const tags = parseTags(body.tags);
    if (!tags) return NextResponse.json({ error: "Tags must be a list." }, { status: 400 });
    changes.tags = tags;
  }

  // Only highlights have a colour.
  if (body?.color !== undefined && existing.type === "highlight") {
    if (!isHighlightColor(body.color)) return NextResponse.json({ error: "Unknown highlight colour." }, { status: 400 });
    changes.color = body.color;
  }

  if (Object.keys(changes).length === 0) {
    return NextResponse.json({ ok: true });
  }

  const { error } = await supabase
    .from("annotations")
    .update(changes)
    .eq("id", annotationId)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ annotationId: string }> }
) {
  const { annotationId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabase
    .from("annotations")
    .delete()
    .eq("id", annotationId)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
