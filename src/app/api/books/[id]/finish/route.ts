import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { markBookFinished } from "@/lib/stats";

export async function POST(
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

  try {
    await markBookFinished(supabase, user.id, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to mark book as finished.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
