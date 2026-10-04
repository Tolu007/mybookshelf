import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const TYPES = ["highlight", "note", "bookmark"] as const;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("annotations")
    .select("id, type, location, excerpt, note, created_at")
    .eq("book_id", id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ annotations: data });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const type = body?.type;
  const location = body?.location;

  if (!TYPES.includes(type) || typeof location !== "string" || !location) {
    return NextResponse.json({ error: "A valid type and location are required." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("annotations")
    .insert({
      user_id: user.id,
      book_id: id,
      type,
      location,
      excerpt: typeof body?.excerpt === "string" ? body.excerpt.slice(0, 1000) : null,
      note: typeof body?.note === "string" ? body.note.slice(0, 2000) : null,
    })
    .select("id, type, location, excerpt, note, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ annotation: data }, { status: 201 });
}
