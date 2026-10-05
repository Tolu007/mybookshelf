"use client";

import { useState } from "react";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sendOrQueue } from "@/lib/offline-queue";

export function BookmarkButton({
  bookId,
  getCurrentLocation,
  onSaved,
}: {
  bookId: string;
  getCurrentLocation: () => string;
  onSaved: () => void;
}) {
  const [justSaved, setJustSaved] = useState(false);

  async function save() {
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1500);
    await sendOrQueue(`/api/books/${bookId}/annotations`, "POST", {
      type: "bookmark",
      location: getCurrentLocation(),
    });
    onSaved();
  }

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="Bookmark this page"
      onClick={save}
      disabled={justSaved}
    >
      {justSaved ? <BookmarkCheck /> : <Bookmark />}
    </Button>
  );
}
