"use client";

import { useState } from "react";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

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
    await fetch(`/api/books/${bookId}/annotations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "bookmark", location: getCurrentLocation() }),
    }).catch(() => {});
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
