import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { getDriveStorageQuota } from "@/lib/google/drive";

// Shelf's share of your Google Drive (from file sizes recorded at upload),
// and the Drive's overall usage and limit when Google can be reached.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: books, error } = await fetchAll<{ file_size_bytes: number | null }>((from, to) =>
    supabase.from("books").select("id, file_size_bytes").order("id").range(from, to)
  );
  if (error) {
    return NextResponse.json({ error: "Couldn't read your library." }, { status: 500 });
  }

  const drive = await getDriveStorageQuota(user.id).catch((driveError) => {
    console.error("Drive storage quota unavailable", driveError instanceof Error ? driveError.message : driveError);
    return null;
  });

  return NextResponse.json(
    {
      shelfBytes: books.reduce((sum, book) => sum + Number(book.file_size_bytes ?? 0), 0),
      bookCount: books.length,
      drive,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
