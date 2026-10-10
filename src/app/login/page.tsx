"use client";

import { useState } from "react";
import { ArrowRight, BookOpen, Loader2, NotebookPen, ShieldCheck } from "lucide-react";
import { Brand, ReadingArt } from "@/components/brand";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { DRIVE_SCOPE } from "@/lib/google/constants";

export default function LoginPage() {
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    if (signingIn) return;
    setSigningIn(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          scopes: DRIVE_SCOPE,
          queryParams: { access_type: "offline", prompt: "consent" },
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (authError) throw authError;
    } catch {
      setError("We couldn't start sign-in. Please try again.");
      setSigningIn(false);
    }
  }

  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <section className="relative flex flex-col overflow-hidden bg-[#e9eee3] p-7 sm:p-12 lg:p-16 dark:bg-[#27372b]">
        <Brand />
        <div className="my-auto max-w-lg space-y-6 py-12 lg:py-16">
          <p className="eyebrow text-accent-foreground">A home for your reading life</p>
          <h1 className="font-heading text-[42px] leading-[1.08] tracking-[-0.045em] sm:text-6xl xl:text-7xl">Less noise.<br />More chapters.</h1>
          <p className="max-w-sm text-sm leading-7 text-muted-foreground">A quiet place for the books you love, the ideas you discover, and the reader you&apos;re becoming.</p>
          <ReadingArt className="mx-auto mt-8 hidden scale-110 sm:ml-10 sm:block lg:mt-14 lg:scale-125" />
        </div>
        <p className="hidden text-[10px] tracking-[0.14em] text-muted-foreground uppercase sm:block">Your books. Your pace. Your little corner of the world.</p>
      </section>
      <section className="flex items-center justify-center px-7 py-12 sm:px-12 lg:py-20">
        <div className="w-full max-w-sm space-y-8">
          <div className="space-y-3"><p className="eyebrow">Welcome to Shelf</p><h2 className="font-heading text-3xl tracking-[-0.03em] sm:text-4xl">Make yourself at home.</h2><p className="text-sm leading-6 text-muted-foreground">Your next great read is closer than you think. Sign in to open your personal library.</p></div>
          <div className="space-y-3">
            <Button size="lg" className="w-full justify-between rounded-xl" onClick={signIn} disabled={signingIn}>
              <span className="flex items-center gap-3">{signingIn ? <Loader2 className="size-4 animate-spin" /> : <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true"><path fill="currentColor" d="M21.8 12.2c0-.7-.1-1.4-.2-2.1H12v4h5.5a4.7 4.7 0 0 1-2 3.1v2.6h3.3c2-1.8 3-4.4 3-7.6ZM12 22c2.8 0 5.2-.9 6.8-2.5l-3.3-2.6c-.9.6-2.1 1-3.5 1-2.7 0-5-1.8-5.8-4.2H2.8v2.7A10.2 10.2 0 0 0 12 22ZM6.2 13.7a6.1 6.1 0 0 1 0-3.4V7.6H2.8a10 10 0 0 0 0 8.8l3.4-2.7ZM12 6.1c1.6 0 2.9.5 4 1.5l3-3A9.8 9.8 0 0 0 12 2a10.2 10.2 0 0 0-9.2 5.6l3.4 2.7A6.1 6.1 0 0 1 12 6.1Z" /></svg>}{signingIn ? "Opening your library…" : "Continue with Google"}</span><ArrowRight className="size-4" />
            </Button>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <p className="text-center text-[11px] text-muted-foreground">One sign-in. Your library on every device.</p>
          </div>
          <div className="space-y-5 border-t border-border pt-7">
            {[{ icon: BookOpen, title: "Keep your books close", text: "Your PDFs and EPUBs, together in one place." }, { icon: NotebookPen, title: "Save what stays with you", text: "Highlights and notes, right beside your reading." }, { icon: ShieldCheck, title: "A library that's yours", text: "We only access files Shelf creates in your Drive." }].map((item) => <div key={item.title} className="flex gap-3.5"><span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent/60 text-accent-foreground"><item.icon className="size-4" strokeWidth={1.6} aria-hidden="true" /></span><div><p className="text-xs font-medium">{item.title}</p><p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{item.text}</p></div></div>)}
          </div>
        </div>
      </section>
    </main>
  );
}
