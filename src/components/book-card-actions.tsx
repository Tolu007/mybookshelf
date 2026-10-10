"use client";

import { useState } from "react";
import { Heart, Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

export function BookCardActions({
  bookId,
  initialFavorite,
  initialWantToRead,
}: {
  bookId: string;
  initialFavorite: boolean;
  initialWantToRead: boolean;
}) {
  const router = useRouter();
  const [isFavorite, setIsFavorite] = useState(initialFavorite);
  const [wantToRead, setWantToRead] = useState(initialWantToRead);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(
    field: "is_favorite" | "want_to_read",
    value: boolean,
    setter: (next: boolean) => void
  ) {
    return async (event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (saving) return;
      setSaving(true);
      setError(null);
      setter(value);
      try {
        const response = await fetch(`/api/books/${bookId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [field]: value }),
        });
        if (!response.ok) throw new Error("Could not update book.");
        router.refresh();
      } catch {
        setter(!value);
        setError("Couldn't save. Try again.");
      } finally {
        setSaving(false);
      }
    };
  }
  return (
    <div className="absolute top-2 left-2 flex gap-1">
      <button
        type="button"
        aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
        aria-pressed={isFavorite}
        disabled={saving}
        onClick={toggle("is_favorite", !isFavorite, setIsFavorite)}
        className="rounded-lg bg-background/90 p-2 shadow-xs backdrop-blur-sm transition-colors hover:bg-background focus-visible:outline-2 focus-visible:outline-ring"
      >
        <Heart
          className={cn("size-3.5", isFavorite ? "fill-primary text-primary" : "text-muted-foreground")}
        />
      </button>
      <button
        type="button"
        aria-label={wantToRead ? "Remove from want to read" : "Add to want to read"}
        aria-pressed={wantToRead}
        disabled={saving}
        onClick={toggle("want_to_read", !wantToRead, setWantToRead)}
        className="rounded-lg bg-background/90 p-2 shadow-xs backdrop-blur-sm transition-colors hover:bg-background focus-visible:outline-2 focus-visible:outline-ring"
      >
        <Bookmark
          className={cn("size-3.5", wantToRead ? "fill-primary text-primary" : "text-muted-foreground")}
        />
      </button>
      {error && <span role="alert" className="absolute top-full left-0 mt-1 w-36 rounded-lg bg-background px-2 py-1 text-[10px] text-destructive shadow-sm">{error}</span>}
    </div>
  );
}
