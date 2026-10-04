import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { recordReadingSession } from "@/lib/stats";

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
  const { startedAt, endedAt, durationSeconds, localDate } = body ?? {};

  if (
    typeof startedAt !== "string" ||
    typeof endedAt !== "string" ||
    typeof durationSeconds !== "number" ||
    typeof localDate !== "string"
  ) {
    return NextResponse.json({ error: "Invalid session payload." }, { status: 400 });
  }

  try {
    await recordReadingSession(supabase, user.id, {
      bookId: id,
      startedAt,
      endedAt,
      durationSeconds,
      localDate,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to record session.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
