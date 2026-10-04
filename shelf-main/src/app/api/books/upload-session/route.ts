import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createResumableUploadSession } from "@/lib/google/drive";
import { detectBookFormat } from "@/lib/book-format";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const fileName = body?.fileName;
  const mimeType = body?.mimeType;

  if (typeof fileName !== "string" || !fileName) {
    return NextResponse.json({ error: "A file name is required." }, { status: 400 });
  }
  if (!detectBookFormat(fileName, mimeType)) {
    return NextResponse.json(
      { error: "Only PDF and EPUB files are supported." },
      { status: 400 }
    );
  }

  try {
    const uploadUrl = await createResumableUploadSession(user.id, {
      name: fileName,
      mimeType: typeof mimeType === "string" && mimeType ? mimeType : "application/octet-stream",
    });
    return NextResponse.json({ uploadUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start upload.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
