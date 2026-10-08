"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { NotebookPen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { sendOrQueue } from "@/lib/offline-queue";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type BookInProgress = { id: string; title: string; location: string };

export function NewNoteDialog({ booksInProgress }: { booksInProgress: BookInProgress[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [bookId, setBookId] = useState(booksInProgress[0]?.id ?? "");
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    const book = booksInProgress.find((b) => b.id === bookId);
    if (!book || !text.trim()) return;

    setSaving(true);
    await sendOrQueue(`/api/books/${book.id}/annotations`, "POST", {
      type: "note",
      location: book.location,
      note: text.trim(),
    });
    setSaving(false);
    setText("");
    setOpen(false);
    router.refresh();
  }

  if (booksInProgress.length === 0) {
    return (
      <Button variant="outline" size="sm" disabled title="Start reading a book first">
        <NotebookPen />
        New note
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <NotebookPen />
        New note
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New journal note</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <select
            value={bookId}
            onChange={(event) => setBookId(event.target.value)}
            className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm"
          >
            {booksInProgress.map((book) => (
              <option key={book.id} value={book.id}>
                {book.title}
              </option>
            ))}
          </select>
          <Textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="What's on your mind?"
            rows={4}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={saving || !text.trim()}>
            {saving ? "Saving…" : "Save note"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
