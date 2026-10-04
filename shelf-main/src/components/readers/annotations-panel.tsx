"use client";

import { useEffect, useState } from "react";
import { Bookmark, Highlighter, List, NotebookPen, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Annotation = {
  id: string;
  type: "highlight" | "note" | "bookmark";
  location: string;
  excerpt: string | null;
  note: string | null;
  created_at: string;
};

const ICONS = { highlight: Highlighter, note: NotebookPen, bookmark: Bookmark };

export function AnnotationsPanel({
  bookId,
  onJumpTo,
  refreshKey,
}: {
  bookId: string;
  onJumpTo: (location: string) => void;
  refreshKey: number;
}) {
  const [open, setOpen] = useState(false);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    // Fetch-on-open: loading state kicks off the request this effect exists for.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    fetch(`/api/books/${bookId}/annotations`)
      .then((res) => res.json())
      .then((data) => setAnnotations(data.annotations ?? []))
      .finally(() => setLoading(false));
  }, [open, bookId, refreshKey]);

  async function remove(id: string) {
    setAnnotations((prev) => prev.filter((a) => a.id !== id));
    await fetch(`/api/annotations/${id}`, { method: "DELETE" }).catch(() => {});
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Notes, highlights & bookmarks" />}>
        <List />
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Highlights, notes & bookmarks</DialogTitle>
        </DialogHeader>
        <div className="max-h-96 space-y-2 overflow-y-auto">
          {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!loading && annotations.length === 0 && (
            <p className="text-sm text-muted-foreground">Nothing saved for this book yet.</p>
          )}
          {annotations.map((annotation) => {
            const Icon = ICONS[annotation.type];
            return (
              <div
                key={annotation.id}
                className="flex items-start gap-2 rounded-lg border border-border p-2"
              >
                <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <button
                  type="button"
                  className="flex-1 text-left text-sm"
                  onClick={() => {
                    onJumpTo(annotation.location);
                    setOpen(false);
                  }}
                >
                  {annotation.excerpt && (
                    <p className="text-muted-foreground italic">&ldquo;{annotation.excerpt}&rdquo;</p>
                  )}
                  {annotation.note && <p>{annotation.note}</p>}
                  {!annotation.excerpt && !annotation.note && (
                    <p className="text-muted-foreground">Bookmark</p>
                  )}
                </button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Delete"
                  onClick={() => remove(annotation.id)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
