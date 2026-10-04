"use client";

import { useState } from "react";
import { Heart, Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";

export function BookCardActions({
  bookId,
  initialFavorite,
  initialWantToRead,
}: {
  bookId: string;
  initialFavorite: boolean;
  initialWantToRead: boolean;
}) {
  const [isFavorite, setIsFavorite] = useState(initialFavorite);
  const [wantToRead, setWantToRead] = useState(initialWantToRead);

  function toggle(
    field: "is_favorite" | "want_to_read",
    value: boolean,
    setter: (next: boolean) => void
  ) {
    return (event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      setter(value);
      fetch(`/api/books/${bookId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      }).catch(() => setter(!value));
    };
  }
//testing
  return (
    <div className="absolute top-2 left-2 flex gap-1">
      <button
        type="button"
        aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
        onClick={toggle("is_favorite", !isFavorite, setIsFavorite)}
        className="rounded-full bg-background/80 p-1.5 backdrop-blur-sm"
      >
        <Heart
          className={cn("size-3.5", isFavorite ? "fill-primary text-primary" : "text-muted-foreground")}
        />
      </button>
      <button
        type="button"
        aria-label={wantToRead ? "Remove from want to read" : "Add to want to read"}
        onClick={toggle("want_to_read", !wantToRead, setWantToRead)}
        className="rounded-full bg-background/80 p-1.5 backdrop-blur-sm"
      >
        <Bookmark
          className={cn("size-3.5", wantToRead ? "fill-primary text-primary" : "text-muted-foreground")}
        />
      </button>
    </div>
  );
}
