"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { NotebookPen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { sendOrQueue } from "@/lib/offline-queue";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

type JournalBook = { id: string; title: string; location: string | null };

export function NewNoteDialog({ books }: { books: JournalBook[] }) {
  const router = useRouter();
  const inputId = useId();
  const [open, setOpen] = useState(false);
  // Empty string means "not tied to any book".
  const [bookId, setBookId] = useState("");
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function save() {
    if (!text.trim() || saving) return;
    const book = books.find((item) => item.id === bookId);
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      const response = await sendOrQueue("/api/annotations", "POST", {
        bookId: book?.id ?? null,
        location: book?.location ?? null,
        note: text.trim(),
      });
      if (response && !response.ok) throw new Error("Your note couldn't be saved. Please try again.");
      setStatus(response ? "Note saved." : "Note queued on this device. It will sync when you're back online.");
      setText("");
      setOpen(false);
      router.refresh();
    } catch {
      setError("Your note couldn't be saved. Your draft is still here.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <Dialog open={open} onOpenChange={(next) => { if (!saving) setOpen(next); }}>
        <DialogTrigger render={<Button />}><NotebookPen /> New entry</DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>A thought worth keeping</DialogTitle><DialogDescription>Write anything: a reflection, an idea, a plan. Link a book if it belongs to one.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={inputId + "-book"}>Book (optional)</Label>
              <select id={inputId + "-book"} value={bookId} onChange={(event) => setBookId(event.target.value)} disabled={saving} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <option value="">Not linked to a book</option>
                {books.map((book) => <option key={book.id} value={book.id}>{book.title}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor={inputId + "-note"}>Your entry</Label>
              <Textarea id={inputId + "-note"} value={text} onChange={(event) => setText(event.target.value)} placeholder="What's on your mind?" rows={5} maxLength={2000} disabled={saving} autoFocus className="bg-background leading-relaxed" />
              <p className="text-right text-[10px] text-muted-foreground">{text.length} / 2,000</p>
            </div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Keep writing later</Button><Button onClick={save} disabled={saving || !text.trim()}>{saving ? "Saving…" : "Save entry"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      {status && <p role="status" className="mt-2 max-w-60 text-xs text-muted-foreground">{status}</p>}
    </div>
  );
}
