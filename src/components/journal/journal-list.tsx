"use client";

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { BookOpen, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type JournalNote = {
  id: string;
  note: string;
  location: string;
  createdAt: string;
  book: { id: string; title: string; coverUrl: string | null };
};

export function JournalList({ initialNotes }: { initialNotes: JournalNote[] }) {
  const [notes, setNotes] = useState(initialNotes);

  async function remove(id: string) {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    await fetch(`/api/annotations/${id}`, { method: "DELETE" }).catch(() => {});
  }

  if (notes.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">
        No notes yet. Open a book and tap the note icon while reading, or use
        “New note” above once you've started a book.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {notes.map((entry) => (
        <div key={entry.id} className="flex gap-3 rounded-xl border border-border bg-card p-4">
          {entry.book.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={entry.book.coverUrl}
              alt=""
              className="h-16 w-11 shrink-0 rounded object-cover"
            />
          ) : (
            <div className="flex h-16 w-11 shrink-0 items-center justify-center rounded bg-muted">
              <BookOpen className="size-4 text-muted-foreground" />
            </div>
          )}
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <Link
                href={{ pathname: `/read/${entry.book.id}`, query: { location: entry.location } }}
                className="truncate text-sm font-medium hover:underline"
              >
                {entry.book.title}
              </Link>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Delete note"
                onClick={() => remove(entry.id)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
            <p className="whitespace-pre-wrap text-sm">{entry.note}</p>
            <p className="text-xs text-muted-foreground">
              {format(new Date(entry.createdAt), "MMM d, yyyy · h:mm a")}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
