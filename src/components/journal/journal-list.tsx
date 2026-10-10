"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { ArrowUpRight, BookOpen, NotebookPen, Quote, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type JournalNote = {
  id: string;
  note: string;
  location: string;
  createdAt: string;
  book: { id: string; title: string; coverUrl: string | null };
};

export function JournalList({ initialNotes }: { initialNotes: JournalNote[] }) {
  const router = useRouter();
  // Derive from refreshed server props instead of keeping a stale copy of the list.
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const notes = initialNotes.filter((note) => !hiddenIds.includes(note.id));

  async function remove(id: string) {
    setError(null);
    setHiddenIds((prev) => [...prev, id]);
    try {
      const response = await fetch(`/api/annotations/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Your note couldn't be deleted. Please try again.");
      router.refresh();
    } catch {
      setHiddenIds((prev) => prev.filter((hiddenId) => hiddenId !== id));
      setError("Your note couldn't be deleted. Please try again.");
    }
  }

  return (
    <div className="space-y-5">
      {error && <p role="alert" className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p>}
      {notes.length === 0 ? (
        <div className="surface flex flex-col items-center px-6 py-16 text-center">
          <span className="mb-5 flex size-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground"><NotebookPen className="size-6" strokeWidth={1.5} aria-hidden="true" /></span>
          <h2 className="font-heading text-2xl tracking-tight">Good thoughts deserve a place.</h2>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">Write a note while you read, or use “New note” after starting a book. Your ideas will be waiting here.</p>
          <Link href="/" className="mt-5 inline-flex items-center gap-2 text-xs font-medium text-primary hover:underline">Find a book to get lost in <ArrowUpRight className="size-3.5" /></Link>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {notes.map((entry) => (
            <article key={entry.id} className="surface flex min-w-0 flex-col overflow-hidden">
              <div className="flex items-center justify-between px-5 pt-5">
                <Quote className="size-5 text-primary/60" strokeWidth={1.4} aria-hidden="true" />
                <time dateTime={entry.createdAt} className="text-[10px] text-muted-foreground">{format(new Date(entry.createdAt), "MMM d, yyyy")}</time>
                <Button variant="ghost" size="icon-sm" aria-label={`Delete note from ${entry.book.title}`} onClick={() => remove(entry.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="size-3.5" /></Button>
              </div>
              <p className="flex-1 whitespace-pre-wrap break-words px-5 py-5 text-[14px] leading-7">{entry.note}</p>
              <Link href={{ pathname: `/read/${entry.book.id}`, query: { location: entry.location } }} className="flex items-center gap-3 border-t border-border bg-muted/20 px-5 py-4 transition-colors hover:bg-accent/40">
                {entry.book.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- accepts embedded covers
                  <img src={entry.book.coverUrl} alt="" className="h-11 w-8 shrink-0 rounded-sm object-cover shadow-sm" loading="lazy" />
                ) : <span className="flex h-11 w-8 shrink-0 items-center justify-center rounded-sm bg-accent text-accent-foreground"><BookOpen className="size-4" /></span>}
                <span className="min-w-0 flex-1"><span className="block truncate text-xs font-medium">{entry.book.title}</span><span className="mt-1 block text-[10px] text-muted-foreground">Return to this moment</span></span>
                <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </Link>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
