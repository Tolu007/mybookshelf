"use client";

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

  async function save() {
    if (!text.trim()) return;
    setSaving(true);
    await sendOrQueue(`/api/books/${bookId}/annotations`, "POST", {
      type: "note",
      location: getCurrentLocation(),
      note: text.trim(),
    });
    setSaving(false);
    setText("");
    setOpen(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Add a note" />}>
        <NotebookPen />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a note</DialogTitle>
        </DialogHeader>
        <Textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="What's on your mind?"
          rows={4}
        />
        <DialogFooter>
          <Button onClick={save} disabled={saving || !text.trim()}>
            {saving ? "Saving…" : "Save note"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
