import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deleteBookFile } from "@/lib/google/drive";
import { resolveCategoryId } from "@/lib/categories";

export async function PATCH(
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
  if (!body) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const update: Record<string, unknown> = {};

  if (typeof body.is_favorite === "boolean") update.is_favorite = body.is_favorite;
  if (typeof body.want_to_read === "boolean") update.want_to_read = body.want_to_read;

  if (typeof body.title === "string") {
    if (!body.title.trim()) {
      return NextResponse.json({ error: "Title can't be empty." }, { status: 400 });
    }
    update.title = body.title.trim();
  }

  if (typeof body.author === "string") {
    update.author = body.author.trim() || null;
  }

  if (typeof body.category === "string") {
    update.category_id = body.category.trim()
      ? await resolveCategoryId(supabase, user.id, body.category.trim())
      : null;
  }

  if (typeof body.cover_url === "string") {
    update.cover_url =
      body.cover_url.startsWith("data:image/") && body.cover_url.length < 2_000_000
        ? body.cover_url
        : null;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const { data: book, error } = await supabase
    .from("books")
    .update(update)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ book });
}

export async function DELETE(
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

  const { data: book } = await supabase
    .from("books")
    .select("drive_file_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!book) {
    return NextResponse.json({ error: "Book not found." }, { status: 404 });
  }

  try {
    await deleteBookFile(user.id, book.drive_file_id);
  } catch (error) {
    // Don't block library cleanup on a Drive-side hiccup (e.g. the file was
    // already removed by hand) — just log it and still remove our record.
    console.error("Drive file deletion failed", error);
  }

  const { error } = await supabase
    .from("books")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
