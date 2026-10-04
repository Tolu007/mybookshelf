import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PUT(
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
  const location = typeof body?.location === "string" ? body.location : null;
  const percent =
    typeof body?.percent === "number" && Number.isFinite(body.percent)
      ? Math.min(100, Math.max(0, body.percent))
      : null;

  if (location === null || percent === null) {
    return NextResponse.json({ error: "location and percent are required." }, { status: 400 });
  }

  const { error } = await supabase.from("reading_progress").upsert({
    book_id: id,
    user_id: user.id,
    location,
    percent,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
