"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { formatDistanceToNowStrict } from "date-fns";
import { BookOpen, PanelRightClose, PencilLine, PlusCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sendOrQueue } from "@/lib/offline-queue";
import { cn } from "@/lib/utils";

export type Annotation = {
  id: string;
  type: "highlight" | "note" | "bookmark";
  location: string;
  excerpt: string | null;
  note: string | null;
  created_at: string;
};

const DOT = { highlight: "bg-ribbon", note: "bg-primary", bookmark: "bg-muted-foreground" };
const STORAGE_KEY = "shelf-notes-panel";

// Remembers (per device) whether the panel was left open.
export function useNotesPanelState() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      // localStorage is only readable after mount.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpen(localStorage.getItem(STORAGE_KEY) === "open");
    } catch {
      // Storage unavailable: start closed.
    }
  }, []);

  const update = useCallback((next: boolean) => {
    setOpen(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "open" : "closed");
    } catch {
      // The panel still works for this visit.
    }
  }, []);

  return [open, update] as const;
}

// This book's notes, highlights and bookmarks, refetched whenever
// `refreshKey` changes (a new highlight, bookmark or note).
export function useBookAnnotations(bookId: string, refreshKey: number) {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/books/${bookId}/annotations`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setAnnotations(data.annotations ?? []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [bookId, refreshKey]);

  const remove = useCallback(async (annotationId: string) => {
    setAnnotations((prev) => prev.filter((annotation) => annotation.id !== annotationId));
    await fetch(`/api/annotations/${annotationId}`, { method: "DELETE" }).catch(() => {});
  }, []);

  return { annotations, loading, remove };
}

export function NotesPanelToggle({ open, onToggle, panelId, count }: { open: boolean; onToggle: () => void; panelId: string; count: number }) {
  return (
    <Button
      size="sm"
      variant={open ? "secondary" : "default"}
      aria-expanded={open}
      aria-controls={panelId}
      onClick={onToggle}
      className="ml-1"
    >
      <BookOpen /> <span className="hidden sm:inline">Journal &amp; annotations</span>
      <span className="sr-only sm:hidden">Notes</span>
      <span className={cn("rounded-full px-1.5 text-[10px] font-bold tabular-nums", open ? "bg-primary text-primary-foreground" : "bg-primary-foreground/90 text-primary")}>{count}</span>
    </Button>
  );
}

// The session journal beside the page: write a note pinned to where you
// are, and see this book's notes, highlights and bookmarks.
export function ReaderNotesPanel({
  id,
  bookId,
  bookTitle,
  open,
  onClose,
  annotations,
  loading,
  onDelete,
  getCurrentLocation,
  describeLocation,
  onJumpTo,
  onSaved,
  onActivity,
}: {
  id: string;
  bookId: string;
  bookTitle: string;
  open: boolean;
  onClose: () => void;
  annotations: Annotation[];
  loading: boolean;
  onDelete: (annotationId: string) => void;
  getCurrentLocation: () => string;
  // e.g. "Page 12" for PDFs; null when a location means nothing to a reader.
  describeLocation: (location: string) => string | null;
  onJumpTo: (location: string) => void;
  onSaved: () => void;
  // Typing a note counts as reading activity (for auto-pause).
  onActivity?: () => void;
}) {
  const inputId = useId();
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  async function save() {
    if (!text.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const response = await sendOrQueue(`/api/books/${bookId}/annotations`, "POST", {
        type: "note",
        location: getCurrentLocation(),
        note: text.trim(),
      });
      if (response && !response.ok) throw new Error("Could not save note.");
      setText("");
      onSaved();
    } catch {
      setError("Your note couldn't be saved. Your draft is still here.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  const notes = annotations.filter((annotation) => annotation.type === "note").length;
  const highlights = annotations.filter((annotation) => annotation.type === "highlight").length;
  const here = describeLocation(getCurrentLocation());

  return (
    <aside
      id={id}
      aria-label="Session journal"
      className="fixed inset-y-0 right-0 z-40 flex w-[min(24rem,90vw)] flex-col border-l border-border bg-popover p-4 shadow-[var(--shadow-lift)] md:static md:z-auto md:h-full md:w-80 md:shrink-0 md:rounded-2xl md:border lg:w-96"
    >
      <div className="flex items-start justify-between gap-2 border-b border-border pb-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 font-heading text-xl leading-7 font-semibold text-sage">
            Session journal <span className="rounded-sm bg-ribbon/20 px-1.5 py-0.5 font-sans text-[10px] font-bold text-amber">Active</span>
          </h2>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {bookTitle} • {notes} {notes === 1 ? "note" : "notes"}, {highlights} {highlights === 1 ? "highlight" : "highlights"}
          </p>
        </div>
        <Button variant="ghost" size="icon-sm" aria-label="Close notes panel" onClick={onClose} className="text-muted-foreground">
          <PanelRightClose />
        </Button>
      </div>

      <div className="my-4 space-y-2.5 rounded-xl bg-card p-3 dark:bg-secondary">
        <label htmlFor={inputId} className="flex items-center justify-between text-xs font-semibold text-sage">
          <span className="flex items-center gap-1"><PencilLine className="size-3.5" aria-hidden="true" /> Write your thoughts</span>
          {here && <span className="font-normal text-muted-foreground">{here} citation</span>}
        </label>
        <textarea
          id={inputId}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            onActivity?.();
          }}
          placeholder="Capture a reflection from this page…"
          rows={3}
          maxLength={2000}
          disabled={saving}
          className="field-sizing-content min-h-20 w-full resize-none rounded-lg bg-popover px-3 py-2 text-[13px] leading-5 outline-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-sage dark:bg-background"
        />
        {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
        <div className="flex justify-end">
          <Button size="sm" onClick={save} disabled={saving || !text.trim()}>
            <PlusCircle /> {saving ? "Saving…" : "Save to journal"}
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between py-1 text-[11px] text-muted-foreground">
        <h3 className="font-semibold tracking-[0.06em] uppercase">Passage log &amp; notes</h3>
        <span>Newest first</span>
      </div>
      <div className="-mr-1 min-h-0 flex-1 space-y-3 overflow-y-auto pt-2 pr-1">
        {loading && annotations.length === 0 && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!loading && annotations.length === 0 && (
          <p className="text-sm text-muted-foreground">Nothing saved for this book yet. Highlights, bookmarks and notes will appear here.</p>
        )}
        {annotations.map((annotation) => {
          const where = describeLocation(annotation.location);
          return (
            <article key={annotation.id} className="group flex flex-col gap-1.5 rounded-xl bg-card p-3 transition-colors hover:bg-secondary dark:bg-secondary dark:hover:bg-accent">
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5 text-xs font-bold">
                  <span className={cn("size-2 shrink-0 rounded-full", DOT[annotation.type])} aria-hidden="true" />
                  <span className="truncate capitalize">{where ?? annotation.type}</span>
                </span>
                <time dateTime={annotation.created_at} className="shrink-0 text-[11px] text-muted-foreground">
                  {formatDistanceToNowStrict(new Date(annotation.created_at), { addSuffix: true })}
                </time>
              </div>
              <button
                type="button"
                className="block w-full space-y-1.5 text-left"
                onClick={() => onJumpTo(annotation.location)}
                aria-label={`Go to this ${annotation.type}`}
              >
                {annotation.excerpt && (
                  <p className="line-clamp-3 font-heading text-[13px] leading-5 text-muted-foreground italic">&ldquo;{annotation.excerpt}&rdquo;</p>
                )}
                {annotation.note && <p className="rounded-md bg-popover p-2 text-[13px] leading-5 whitespace-pre-wrap dark:bg-background">{annotation.note}</p>}
                {!annotation.excerpt && !annotation.note && <p className="text-[13px] text-muted-foreground">Bookmarked this page</p>}
              </button>
              <div className="flex justify-end">
                <Button variant="ghost" size="icon-xs" aria-label={`Delete ${annotation.type}`} onClick={() => onDelete(annotation.id)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 />
                </Button>
              </div>
            </article>
          );
        })}
      </div>
    </aside>
  );
}
