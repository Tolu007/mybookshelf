"use client";

import { useState } from "react";
import { ArrowRight, BookOpen, CloudOff, FolderLock, Loader2, Lock, NotebookPen } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { DRIVE_SCOPE } from "@/lib/google/constants";
import { QUOTES } from "@/lib/quotes";

// The decorative "stand" on the brand panel: what Shelf actually does.
const STAND = [
  { code: "PDF·EPUB", title: "Your books", note: "Read anywhere", tone: "bg-[#1f2a24]" },
  { code: "NOTES", title: "Your journal", note: "With or without a book", tone: "bg-[#1f2a24]" },
  { code: "STREAK", title: "Your rhythm", note: "Days, hours, chapters", tone: "bg-[#2e231b]" },
  { code: "DRIVE", title: "Your files", note: "Kept in Google Drive", tone: "bg-[#1f2a24]" },
];

const FACTS = [
  { icon: FolderLock, label: "Books stay in your Drive" },
  { icon: Lock, label: "Private to your account" },
  { icon: CloudOff, label: "Progress syncs after offline reading" },
];

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
    <main className="grid min-h-dvh lg:grid-cols-2">
      <section className="relative flex flex-col overflow-hidden bg-[linear-gradient(160deg,#1a3a2b_0%,#234b39_45%,#14301f_100%)] p-7 text-[#e8e4dc] sm:p-12 lg:p-16 dark:bg-[linear-gradient(160deg,#152019_0%,#121614_60%,#0e1a13_100%)]">
        <BookOpen aria-hidden="true" strokeWidth={0.6} className="pointer-events-none absolute top-1/2 left-1/2 size-[520px] -translate-x-1/3 -translate-y-1/2 text-white/[0.04]" />
        <div className="relative flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-lg border border-white/15 bg-white/10"><BookOpen className="size-5" strokeWidth={1.6} aria-hidden="true" /></span>
          <div>
            <p className="font-heading text-xl leading-6 font-semibold">Shelf</p>
            <p className="text-[11px] tracking-[0.12em] text-[#e8e4dc]/70 uppercase">Personal library</p>
          </div>
        </div>

        <div className="relative my-auto max-w-xl space-y-6 py-12 lg:py-16">
          <p className="text-xs font-semibold tracking-[0.18em] text-[#f6bc61] uppercase">Ex libris</p>
          <h1 className="font-heading text-[40px] leading-[1.08] font-normal tracking-[-0.02em] sm:text-[56px]">A quiet place for the books you love and the thoughts they leave behind.</h1>
          <p className="max-w-lg font-heading text-lg leading-8 text-[#e8e4dc]/80 italic">&ldquo;{QUOTES[1]?.text ?? QUOTES[0].text}&rdquo;</p>
          <div className="hidden rounded-xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur-sm sm:block">
            <p className="mb-4 border-b border-white/10 pb-3 text-[11px] tracking-[0.08em] text-[#e8e4dc]/70 uppercase">On the stand</p>
            <div className="grid grid-cols-4 gap-3">
              {STAND.map((item) => (
                <div key={item.code} className={`${item.tone} flex aspect-3/4 flex-col justify-between rounded-md border border-white/10 p-3`}>
                  <span className="text-[10px] font-semibold tracking-[0.1em] text-[#9cd2b4]">{item.code}</span>
                  <span className="font-heading text-base leading-5">{item.title}</span>
                  <span className="text-[10px] text-[#e8e4dc]/60">{item.note}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <p className="relative hidden items-center gap-2 border-t border-white/10 pt-5 text-[11px] tracking-[0.12em] text-[#e8e4dc]/60 uppercase sm:flex">
          <NotebookPen className="size-3.5" aria-hidden="true" /> Your books · Your pace · Your notes
        </p>
      </section>

      <section className="flex flex-col px-7 py-10 sm:px-12 lg:px-20 lg:py-14">
        <div className="flex items-center gap-3">
          <span className="font-heading text-3xl font-semibold text-sage">Shelf</span>
          <span className="h-5 w-px bg-border" aria-hidden="true" />
          <span className="text-xs tracking-[0.12em] text-muted-foreground uppercase">Personal library</span>
        </div>

        <div className="my-auto w-full max-w-md space-y-8 py-12">
          <div className="space-y-3">
            <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.12em] text-amber uppercase"><Lock className="size-3.5" aria-hidden="true" /> Welcome back</p>
            <h2 className="font-heading text-4xl leading-tight font-normal tracking-[-0.015em] sm:text-5xl">Enter your library</h2>
            <p className="font-heading text-lg leading-8 text-muted-foreground">Your books, notes and reading streaks, waiting where you left them.</p>
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={signIn}
              disabled={signingIn}
              className="flex h-14 w-full items-center justify-between gap-3 rounded-lg border border-border bg-popover px-5 text-base font-semibold shadow-[var(--shadow-card)] transition-colors hover:border-sage/40 hover:bg-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-70 dark:bg-card dark:hover:bg-secondary"
            >
              <span className="flex items-center gap-3">
                {signingIn ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : (
                  <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
                    <path fill="#4285F4" d="M21.8 12.2c0-.7-.1-1.4-.2-2.1H12v4h5.5a4.7 4.7 0 0 1-2 3.1v2.6h3.3c2-1.8 3-4.4 3-7.6Z" />
                    <path fill="#34A853" d="M12 22c2.8 0 5.2-.9 6.8-2.5l-3.3-2.6c-.9.6-2.1 1-3.5 1-2.7 0-5-1.8-5.8-4.2H2.8v2.7A10.2 10.2 0 0 0 12 22Z" />
                    <path fill="#FBBC05" d="M6.2 13.7a6.1 6.1 0 0 1 0-3.4V7.6H2.8a10 10 0 0 0 0 8.8l3.4-2.7Z" />
                    <path fill="#EA4335" d="M12 6.1c1.6 0 2.9.5 4 1.5l3-3A9.8 9.8 0 0 0 12 2a10.2 10.2 0 0 0-9.2 5.6l3.4 2.7A6.1 6.1 0 0 1 12 6.1Z" />
                  </svg>
                )}
                {signingIn ? "Opening your library…" : "Continue with Google"}
              </span>
              <ArrowRight className="size-5 text-muted-foreground" aria-hidden="true" />
            </button>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <p className="text-center text-xs text-muted-foreground">Google sign-in lets Shelf store and open your books in your Drive.</p>
          </div>

          <ul className="grid grid-cols-1 gap-4 border-t border-border pt-7 sm:grid-cols-3">
            {FACTS.map((fact) => (
              <li key={fact.label} className="flex items-center gap-2.5 sm:flex-col sm:text-center">
                <fact.icon className="size-5 shrink-0 text-sage" strokeWidth={1.6} aria-hidden="true" />
                <span className="text-xs text-muted-foreground">{fact.label}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="border-t border-border pt-5 text-xs text-muted-foreground">Shelf only opens files it created in your Google Drive.</p>
      </section>
    </main>
  );
}
