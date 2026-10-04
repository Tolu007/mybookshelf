import { Readable } from "node:stream";
import { createClient } from "@/lib/supabase/server";
import { getBookFileStream } from "@/lib/google/drive";

const CONTENT_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  epub: "application/epub+zip",
};

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
    return new Response("Unauthorized", { status: 401 });
  }

  const { data: book } = await supabase
    .from("books")
    .select("drive_file_id, format")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!book) {
    return new Response("Not found", { status: 404 });
  }

  const stream = await getBookFileStream(user.id, book.drive_file_id);
  const webStream = Readable.toWeb(stream) as ReadableStream;

  return new Response(webStream, {
    headers: {
      "Content-Type": CONTENT_TYPES[book.format] ?? "application/octet-stream",
      "Cache-Control": "private, no-store",
    },
  });
}
