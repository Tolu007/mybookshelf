import { createClient } from "@/lib/supabase/server";
import { DRIVE_SCOPE } from "@/lib/google/constants";

export async function storeGoogleRefreshToken(
  userId: string,
  refreshToken: string
) {
  const supabase = await createClient();
  await supabase.from("user_google_tokens").upsert({
    user_id: userId,
    refresh_token: refreshToken,
    scope: DRIVE_SCOPE,
    updated_at: new Date().toISOString(),
  });
}
