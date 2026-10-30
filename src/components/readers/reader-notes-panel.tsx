"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { formatDistanceToNowStrict } from "date-fns";
import { Bookmark, Highlighter, NotebookPen, PanelRightClose, PanelRightOpen, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sendOrQueue } from "@/lib/offline-queue";
import { cn } from "@/lib/utils";

type Annotation = {
  id: string;
  type: "highlight" | "note" | "bookmark";
  location: string;
  excerpt: string | null;
  note: string | null;
  created_at: string;
};

const ICONS = { highlight: Highlighter, note: NotebookPen, bookmark: Bookmark };
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

export function NotesPanelToggle({ open, onToggle, panelId }: { open: boolean; onToggle: () => void; panelId: string }) {
  return (
    <Button
      variant={open ? "secondary" : "ghost"}
      size="sm"
      aria-expanded={open}
      aria-controls={panelId}
      onClick={onToggle}
      className={cn(open && "text-sage")}
    >
      {open ? <PanelRightClose /> : <PanelRightOpen />} Notes
    </Button>
  );
}

// The session journal beside the page: write a note pinned to where you
// are, and see this book's notes, highlights and bookmarks.
export function ReaderNotesPanel({
  id,
  bookId,
  open,
  onClose,
  getCurrentLocation,
  describeLocation,
  onJumpTo,
  refreshKey,
  onSaved,
  onActivity,
}: {
  id: string;
  bookId: string;
  open: boolean;
  onClose: () => void;
  getCurrentLocation: () => string;
  // e.g. "Page 12" for PDFs; null when a location means nothing to a reader.
  describeLocation: (location: string) => string | null;
  onJumpTo: (location: string) => void;
  refreshKey: number;
  onSaved: () => void;
  // Typing a note counts as reading activity (for auto-pause).
  onActivity?: () => void;
}) {
  const inputId = useId();
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    // Fetch-on-open: loading state kicks off the request this effect exists for.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
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
  }, [open, bookId, refreshKey, reloadKey]);

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
      setReloadKey((value) => value + 1);
      onSaved();
    } catch {
      setError("Your note couldn't be saved. Your draft is still here.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(annotationId: string) {
    setAnnotations((prev) => prev.filter((annotation) => annotation.id !== annotationId));
    await fetch(`/api/annotations/${annotationId}`, { method: "DELETE" }).catch(() => {});
  }

  if (!open) return null;

  const notes = annotations.filter((annotation) => annotation.type === "note").length;
  const highlights = annotations.filter((annotation) => annotation.type === "highlight").length;
  const here = describeLocation(getCurrentLocation());

  return (
    <aside
      id={id}
      aria-label="Session journal"
      className="fixed inset-y-0 right-0 z-40 flex w-[min(24rem,90vw)] flex-col border-l border-border bg-card shadow-[var(--shadow-lift)] md:static md:z-auto md:w-80 md:shrink-0 md:shadow-none lg:w-96"
    >
      <div className="flex items-start justify-between gap-2 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 font-heading text-lg leading-6 font-semibold">
            Session journal <span className="tag text-amber">Active</span>
          </h2>
          <p className="meta mt-0.5">{notes} {notes === 1 ? "note" : "notes"} · {highlights} {highlights === 1 ? "highlight" : "highlights"}</p>
        </div>
        <Button variant="ghost" size="icon-sm" aria-label="Close notes panel" onClick={onClose} className="text-muted-foreground">
          <PanelRightClose />
        </Button>
      </div>

      <div className="space-y-2 border-b border-border px-4 py-3">
        <label htmlFor={inputId} className="flex items-center justify-between text-xs font-semibold">
          <span className="flex items-center gap-1.5"><NotebookPen className="size-3.5 text-sage" aria-hidden="true" /> Write a note</span>
          {here && <span className="meta">{here}</span>}
        </label>
        <textarea
          id={inputId}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            onActivity?.();
          }}
          placeholder="A thought from this page…"
          rows={4}
          maxLength={2000}
          disabled={saving}
          className="field-sizing-content min-h-24 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 font-heading text-base leading-6 outline-none placeholder:text-muted-foreground focus-visible:border-sage/60 focus-visible:ring-3 focus-visible:ring-primary/15 dark:bg-well"
        />
        {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
        <div className="flex items-center justify-between gap-2">
          <span className="meta">Saved to your journal</span>
          <Button size="sm" onClick={save} disabled={saving || !text.trim()}>
            <Save /> {saving ? "Saving…" : "Save note"}
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <h3 className="text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">Notes, highlights & bookmarks</h3>
        <span className="meta">Newest first</span>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 pb-4">
        {loading && annotations.length === 0 && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!loading && annotations.length === 0 && (
          <p className="text-sm text-muted-foreground">Nothing saved for this book yet. Highlights, bookmarks and notes will appear here.</p>
        )}
        {annotations.map((annotation) => {
          const Icon = ICONS[annotation.type];
          const where = describeLocation(annotation.location);
          return (
            <article key={annotation.id} className="rounded-lg border border-border bg-background p-3 dark:bg-secondary">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5 text-xs font-semibold">
                  <Icon className={cn("size-3.5 shrink-0", annotation.type === "highlight" ? "text-amber" : "text-sage")} aria-hidden="true" />
                  <span className="truncate capitalize">{where ?? annotation.type}</span>
                </span>
                <time dateTime={annotation.created_at} className="meta shrink-0">
                  {formatDistanceToNowStrict(new Date(annotation.created_at), { addSuffix: true })}
                </time>
              </div>
              <button
                type="button"
                className="block w-full text-left"
                onClick={() => onJumpTo(annotation.location)}
                aria-label={`Go to this ${annotation.type}`}
              >
                {annotation.excerpt && (
                  <p className="font-heading text-sm leading-6 text-muted-foreground italic">&ldquo;{annotation.excerpt}&rdquo;</p>
                )}
                {annotation.note && <p className="mt-1 text-sm leading-6 whitespace-pre-wrap">{annotation.note}</p>}
                {!annotation.excerpt && !annotation.note && <p className="text-sm text-muted-foreground">Bookmark</p>}
              </button>
              <div className="mt-1.5 flex justify-end">
                <Button variant="ghost" size="icon-xs" aria-label={`Delete ${annotation.type}`} onClick={() => remove(annotation.id)} className="text-muted-foreground hover:text-destructive">
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
