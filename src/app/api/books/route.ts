import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchBookMetadata } from "@/lib/book-metadata";
import { detectBookFormat } from "@/lib/book-format";
import { resolveCategoryId } from "@/lib/categories";

// Finalizes a book after its file has already been uploaded directly to
// Drive from the browser (see /api/books/upload-session) — this endpoint
// only ever handles small JSON metadata, never file bytes.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const title = body?.title;
  const author = body?.author;
  const categoryName = body?.category;
  const driveFileId = body?.driveFileId;
  const sizeBytes = body?.sizeBytes;
  const fileName = body?.fileName;
  const mimeType = body?.mimeType;
  const clientCoverRaw = body?.clientCover;

  if (typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "A title is required." }, { status: 400 });
  }
  if (typeof driveFileId !== "string" || !driveFileId) {
    return NextResponse.json({ error: "Missing uploaded file reference." }, { status: 400 });
  }

  const format = detectBookFormat(typeof fileName === "string" ? fileName : "", mimeType);
  if (!format) {
    return NextResponse.json(
      { error: "Only PDF and EPUB files are supported." },
      { status: 400 }
    );
  }

  const clientCover =
    typeof clientCoverRaw === "string" &&
    clientCoverRaw.startsWith("data:image/") &&
    clientCoverRaw.length < 2_000_000
      ? clientCoverRaw
      : null;

  try {
    let categoryId: string | null = null;
    if (typeof categoryName === "string" && categoryName.trim()) {
      categoryId = await resolveCategoryId(supabase, user.id, categoryName.trim());
    }

    const trimmedTitle = title.trim();
    const trimmedAuthor = typeof author === "string" && author.trim() ? author.trim() : null;
    const metadata = await fetchBookMetadata(trimmedTitle, trimmedAuthor);

    const { data: book, error } = await supabase
      .from("books")
      .insert({
        user_id: user.id,
        title: trimmedTitle,
        author: trimmedAuthor ?? metadata?.author ?? null,
        category_id: categoryId,
        format,
        drive_file_id: driveFileId,
        file_size_bytes: typeof sizeBytes === "number" ? sizeBytes : null,
        cover_url: metadata?.coverUrl ?? clientCover,
        description: metadata?.description ?? null,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ book }, { status: 201 });
  } catch (error) {
    console.error("Book creation failed", error);
    const message = error instanceof Error ? error.message : "Failed to save book.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
