"use client";

import { useState } from "react";
import { RatingInput } from "@/components/star-rating";

// Rates a book in place (e.g. in the reader once it's finished), saving
// each change straight away.
export function BookRatingControl({ bookId, initialRating }: { bookId: string; initialRating: number | null }) {
  const [rating, setRating] = useState(initialRating);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  async function rate(next: number | null) {
    const previous = rating;
    setRating(next);
    setSaving(true);
    setError(false);
    try {
      const response = await fetch(`/api/books/${bookId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: next }),
      });
      if (!response.ok) throw new Error("Could not save rating.");
    } catch {
      setRating(previous);
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">{rating ? "Your rating" : "Rate it"}</span>
      <RatingInput value={rating} onChange={rate} disabled={saving} label="Rate this book" starClassName="size-4" />
      {error && <span role="alert" className="text-[11px] text-destructive">Not saved</span>}
    </div>
  );
}
