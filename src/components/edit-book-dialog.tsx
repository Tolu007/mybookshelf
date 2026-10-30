"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { blobToDataUrl } from "@/lib/extract-cover";

type EditableBook = {
  id: string;
  title: string;
  author: string | null;
  cover_url: string | null;
  category_id: string | null;
};

export function EditBookDialog({
  book,
  categories,
  open,
  onOpenChange,
}: {
  book: EditableBook;
  categories: { id: string; name: string }[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(book.title);
  const [author, setAuthor] = useState(book.author ?? "");
  const [category, setCategory] = useState(
    categories.find((c) => c.id === book.category_id)?.name ?? ""
  );
  const [coverPreview, setCoverPreview] = useState<string | null>(book.cover_url);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onCoverChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setCoverPreview(await blobToDataUrl(file));
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const payload: Record<string, unknown> = { title, author, category };
      if (coverPreview !== book.cover_url) {
        payload.cover_url = coverPreview ?? "";
      }

      const response = await fetch(`/api/books/${book.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? "Could not save changes.");
      }

      onOpenChange(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save changes.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Edit book</DialogTitle>
            <DialogDescription>Update the cover, title, author, or category.</DialogDescription>
          </DialogHeader>

          <div className="flex gap-4">
            <div className="flex h-28 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
              {coverPreview ? (
                // eslint-disable-next-line @next/next/no-img-element -- may be a local data: URL
                <img src={coverPreview} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-[10px] text-muted-foreground">No cover</span>
              )}
            </div>
            <div className="flex-1 space-y-2">
              <Label htmlFor="edit-cover">Replace cover image</Label>
              <Input id="edit-cover" type="file" accept="image/*" onChange={onCoverChange} />
              {coverPreview && (
                <button
                  type="button"
                  className="text-xs text-muted-foreground underline"
                  onClick={() => setCoverPreview(null)}
                >
                  Remove cover
                </button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-title">Title</Label>
            <Input
              id="edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-author">Author</Label>
            <Input
              id="edit-author"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Optional"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-category">Category</Label>
            <Input
              id="edit-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              list="edit-category-options"
              placeholder="e.g. Business"
            />
            <datalist id="edit-category-options">
              {categories.map((c) => (
                <option key={c.id} value={c.name} />
              ))}
            </datalist>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
