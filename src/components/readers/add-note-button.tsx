"use client";

import { useId, useState } from "react";
import { NotebookPen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { sendOrQueue } from "@/lib/offline-queue";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function AddNoteButton({
  bookId,
  getCurrentLocation,
  onSaved,
}: {
  bookId: string;
  getCurrentLocation: () => string;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const noteId = useId();

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
      setOpen(false);
      onSaved();
    } catch {
      setError("Your note couldn't be saved. Your draft is still here.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!saving) setOpen(next); }}>
      <DialogTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Add a note" />}>
        <NotebookPen />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a note</DialogTitle>
          <DialogDescription>Keep a thought from this moment in your book.</DialogDescription>
        </DialogHeader>
        <Label htmlFor={noteId}>Your note</Label>
        <Textarea
          id={noteId}
          maxLength={2000}
          disabled={saving}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="What's on your mind?"
          rows={4}
        />
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button onClick={save} disabled={saving || !text.trim()}>
            {saving ? "Saving…" : "Save note"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
