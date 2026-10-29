"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { BookOpen, Feather, NotebookPen, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sendOrQueue } from "@/lib/offline-queue";
import { cn } from "@/lib/utils";

type JournalBook = { id: string; title: string; location: string | null };

// The writing desk at the top of the journal: a standalone reflection, or a
// note linked to one of your books.
export function JournalComposer({ books }: { books: JournalBook[] }) {
  const router = useRouter();
  const inputId = useId();
  const [linked, setLinked] = useState(false);
  const [bookId, setBookId] = useState(books[0]?.id ?? "");
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function save() {
    if (!text.trim() || saving) return;
    const book = linked ? books.find((item) => item.id === bookId) : undefined;
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      const response = await sendOrQueue("/api/annotations", "POST", {
        bookId: book?.id ?? null,
        location: book?.location ?? null,
        note: text.trim(),
      });
      if (response && !response.ok) throw new Error("Your entry couldn't be saved. Please try again.");
      setStatus(response ? "Entry saved." : "Entry queued on this device. It will sync when you're back online.");
      setText("");
      router.refresh();
    } catch {
      setError("Your entry couldn't be saved. Your draft is still here.");
    } finally {
      setSaving(false);
    }
  }

  const modes = [
    { linked: false, label: "Standalone reflection", icon: Feather },
    { linked: true, label: "Link to a book", icon: BookOpen },
  ];

  return (
    <section aria-labelledby={inputId + "-heading"} className="surface overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
        <h2 id={inputId + "-heading"} className="flex items-center gap-2 font-heading text-lg font-semibold">
          <NotebookPen className="size-4 text-sage" aria-hidden="true" /> Writing desk
        </h2>
        <div role="radiogroup" aria-label="Entry type" className="flex rounded-lg border border-border bg-secondary p-0.5">
          {modes.map((mode) => (
            <button
              key={mode.label}
              type="button"
              role="radio"
              aria-checked={linked === mode.linked}
              disabled={saving || (mode.linked && books.length === 0)}
              title={mode.linked && books.length === 0 ? "Add a book to link entries to it" : undefined}
              onClick={() => setLinked(mode.linked)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold tracking-[0.02em] transition-colors disabled:opacity-50",
                linked === mode.linked ? "bg-background text-sage shadow-sm dark:bg-popover" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <mode.icon className="size-3.5" aria-hidden="true" /> {mode.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3 px-4 py-4 sm:px-5">
        {linked && (
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor={inputId + "-book"} className="meta">Linked to</label>
            <select
              id={inputId + "-book"}
              value={bookId}
              onChange={(event) => setBookId(event.target.value)}
              disabled={saving}
              className="h-8 max-w-full min-w-0 flex-1 rounded-lg border border-border bg-background px-2 font-heading text-base outline-none focus-visible:ring-3 focus-visible:ring-primary/15 sm:max-w-sm dark:bg-secondary"
            >
              {books.map((book) => <option key={book.id} value={book.id}>{book.title}</option>)}
            </select>
          </div>
        )}
        <label htmlFor={inputId + "-note"} className="sr-only">Your entry</label>
        <textarea
          id={inputId + "-note"}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={linked ? "What stayed with you from this book?" : "What's on your mind?"}
          rows={5}
          maxLength={2000}
          disabled={saving}
          className="field-sizing-content min-h-32 w-full resize-none rounded-lg border border-border bg-background px-4 py-3 font-heading text-[17px] leading-7 outline-none placeholder:text-muted-foreground focus-visible:border-sage/60 focus-visible:ring-3 focus-visible:ring-primary/15 dark:bg-well"
        />
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {status && !error && <p role="status" className="text-xs text-muted-foreground">{status}</p>}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border bg-card px-4 py-3 sm:px-5">
        <span className="meta">{text.length} / 2,000</span>
        <Button onClick={save} disabled={saving || !text.trim()}>
          <Save /> {saving ? "Saving…" : "Save entry"}
        </Button>
      </div>
    </section>
  );
}
