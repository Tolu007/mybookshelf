import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { storeGoogleRefreshToken } from "@/lib/google/tokens";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      const refreshToken = data.session?.provider_refresh_token;
      if (refreshToken) {
        await storeGoogleRefreshToken(data.user.id, refreshToken);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
