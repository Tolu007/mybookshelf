import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_PREFIX = "https://www.googleapis.com/upload/drive/";

// A thin relay: the browser can't PUT bytes straight to Google's resumable
// upload endpoint (the session-creation call returns CORS headers, but the
// byte-upload endpoint behind it returns none, so browsers block it). Instead
// the browser sends us one small chunk at a time — each well under any
// serverless body-size limit — and we forward it to Drive server-to-server,
// where CORS doesn't apply.
export async function PUT(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const uploadUrl = request.headers.get("x-upload-url");
  const contentRange = request.headers.get("content-range");

  if (!uploadUrl || !contentRange) {
    return NextResponse.json({ error: "Missing upload metadata." }, { status: 400 });
  }
  if (!uploadUrl.startsWith(ALLOWED_PREFIX)) {
    return NextResponse.json({ error: "Invalid upload target." }, { status: 400 });
  }

  const chunk = await request.arrayBuffer();

  let driveResponse: Response;
  try {
    driveResponse = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Range": contentRange,
        "Content-Length": String(chunk.byteLength),
      },
      body: chunk,
    });
  } catch {
    return NextResponse.json({ error: "Could not reach Drive." }, { status: 502 });
  }

  // 308 = Drive has this chunk, send the next one.
  if (driveResponse.status === 308) {
    return new Response(null, { status: 308 });
  }

  if (driveResponse.ok) {
    const body = await driveResponse.json().catch(() => ({}));
    return NextResponse.json(body, { status: driveResponse.status });
  }

  const errorText = await driveResponse.text().catch(() => "");
  return NextResponse.json(
    { error: `Drive rejected the upload (${driveResponse.status}). ${errorText}`.trim() },
    { status: 502 }
  );
}
