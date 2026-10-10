"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { NotebookPen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { sendOrQueue } from "@/lib/offline-queue";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

type BookInProgress = { id: string; title: string; location: string };

export function NewNoteDialog({ booksInProgress }: { booksInProgress: BookInProgress[] }) {
  const router = useRouter();
  const inputId = useId();
  const [open, setOpen] = useState(false);
  const [bookId, setBookId] = useState(booksInProgress[0]?.id ?? "");
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const selectedBookId = booksInProgress.some((book) => book.id === bookId) ? bookId : booksInProgress[0]?.id ?? "";

  async function save() {
    const book = booksInProgress.find((item) => item.id === selectedBookId);
    if (!book || !text.trim() || saving) return;
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      const response = await sendOrQueue(`/api/books/${book.id}/annotations`, "POST", { type: "note", location: book.location, note: text.trim() });
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

  if (booksInProgress.length === 0) {
    return <Button variant="outline" disabled title="Start reading a book first"><NotebookPen /> New note</Button>;
  }

  return (
    <div>
      <Dialog open={open} onOpenChange={(next) => { if (!saving) setOpen(next); }}>
        <DialogTrigger render={<Button />}><NotebookPen /> New note</DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>A thought worth keeping</DialogTitle><DialogDescription>Save an idea, a question, or a little reflection from your reading.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={inputId + "-book"}>From your book</Label>
              <select id={inputId + "-book"} value={selectedBookId} onChange={(event) => setBookId(event.target.value)} disabled={saving} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {booksInProgress.map((book) => <option key={book.id} value={book.id}>{book.title}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor={inputId + "-note"}>Your note</Label>
              <Textarea id={inputId + "-note"} value={text} onChange={(event) => setText(event.target.value)} placeholder="What stayed with you?" rows={5} maxLength={2000} disabled={saving} autoFocus className="bg-background leading-relaxed" />
              <p className="text-right text-[10px] text-muted-foreground">{text.length} / 2,000</p>
            </div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Keep writing later</Button><Button onClick={save} disabled={saving || !text.trim()}>{saving ? "Saving…" : "Save note"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      {status && <p role="status" className="mt-2 max-w-60 text-xs text-muted-foreground">{status}</p>}
    </div>
  );
}
