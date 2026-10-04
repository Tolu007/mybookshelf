"use client";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { DRIVE_SCOPE } from "@/lib/google/constants";

export default function LoginPage() {
  async function signIn() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        scopes: DRIVE_SCOPE,
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 text-center">
      <div className="space-y-2">
        <h1 className="font-heading text-4xl font-medium text-foreground">
          Shelf
        </h1>
        <p className="text-muted-foreground">
          Your library, open on every device.
        </p>
      </div>
      <Button size="lg" onClick={signIn}>
        Continue with Google
      </Button>
      <p className="max-w-xs text-xs text-muted-foreground">
        We only request access to files Shelf itself creates in your Drive —
        never your full Drive contents.
      </p>
    </main>
  );
}
