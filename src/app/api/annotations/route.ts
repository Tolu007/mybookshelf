import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// General-purpose journal notes: bookId and location are optional, so a note
// can be written without being tied to any book.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const note = typeof body?.note === "string" ? body.note.trim() : "";

  if (!note) {
    return NextResponse.json({ error: "A note is required." }, { status: 400 });
  }

  const bookId = typeof body?.bookId === "string" && body.bookId ? body.bookId : null;
  const location = bookId && typeof body?.location === "string" && body.location ? body.location : null;

  const { data, error } = await supabase
    .from("annotations")
    .insert({
      user_id: user.id,
      book_id: bookId,
      type: "note",
      location,
      note: note.slice(0, 2000),
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ annotation: data }, { status: 201 });
}
