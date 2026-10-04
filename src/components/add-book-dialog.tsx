"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { extractClientCover } from "@/lib/extract-cover";
import { detectBookFormat } from "@/lib/book-format";

const CHUNK_SIZE = 4 * 1024 * 1024; // 4MiB — a multiple of 256KiB per Drive's resumable protocol

// Google's resumable upload PUT endpoint doesn't send CORS headers, so the
// browser can't hit it directly. We relay chunks through our own server
// instead — each chunk is small enough to clear any serverless body-size
// limit, and the relay forwards it to Drive with the Content-Range Drive's
// resumable protocol expects.
async function uploadFileInChunks(
  uploadUrl: string,
  file: File,
  onProgress: (fraction: number) => void
): Promise<{ id: string; size?: string }> {
  const total = file.size;
  let start = 0;

  while (start < total) {
    const end = Math.min(start + CHUNK_SIZE, total);
    const chunk = file.slice(start, end);

    const response = await fetch("/api/books/upload-chunk", {
      method: "PUT",
      headers: {
        "Content-Range": `bytes ${start}-${end - 1}/${total}`,
        "X-Upload-Url": uploadUrl,
      },
      body: chunk,
    });

    if (response.status === 308) {
      start = end;
      onProgress(end / total);
      continue;
    }

    if (response.ok) {
      onProgress(1);
      return response.json();
    }

    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? `Upload failed (${response.status}).`);
  }

  throw new Error("Upload did not complete.");
}

export function AddBookDialog({ categories }: { categories: { id: string; name: string }[] }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [isReadingCover, setIsReadingCover] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!title) {
      setTitle(file.name.replace(/\.(pdf|epub)$/i, ""));
    }

    setCoverPreview(null);
    const format = detectBookFormat(file.name, file.type);
    if (!format) return;
    setIsReadingCover(true);
    const cover = await extractClientCover(file, format);
    setIsReadingCover(false);
    setCoverPreview(cover);
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    setUploadProgress(0);

    try {
      const formData = new FormData(event.currentTarget);
      const file = formData.get("file");
      if (!(file instanceof File) || file.size === 0) {
        throw new Error("A book file is required.");
      }

      const format = detectBookFormat(file.name, file.type);
      if (!format) {
        throw new Error("Only PDF and EPUB files are supported.");
      }

      const sessionResponse = await fetch("/api/books/upload-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, mimeType: file.type }),
      });
      if (!sessionResponse.ok) {
        const body = await sessionResponse.json().catch(() => ({}));
        throw new Error(body.error ?? "Could not start the upload.");
      }
      const { uploadUrl } = await sessionResponse.json();

      const uploaded = await uploadFileInChunks(uploadUrl, file, setUploadProgress);

      const finalizeResponse = await fetch("/api/books", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.get("title"),
          author: formData.get("author"),
          category: formData.get("category"),
          fileName: file.name,
          mimeType: file.type,
          driveFileId: uploaded.id,
          sizeBytes: uploaded.size ? Number(uploaded.size) : file.size,
          clientCover: coverPreview,
        }),
      });

      if (!finalizeResponse.ok) {
        const body = await finalizeResponse.json().catch(() => ({}));
        throw new Error(body.error ?? "Upload failed.");
      }

      setOpen(false);
      setTitle("");
      setCoverPreview(null);
      formRef.current?.reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setIsSubmitting(false);
      setUploadProgress(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus /> Add book
      </DialogTrigger>
      <DialogContent>
        <form ref={formRef} onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Add a book</DialogTitle>
            <DialogDescription>
              Uploads straight to your Drive&apos;s &ldquo;Shelf Library&rdquo; folder — any
              file size.
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-4">
            <div className="flex h-28 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
              {isReadingCover ? (
                <span className="text-[10px] text-muted-foreground">Reading…</span>
              ) : coverPreview ? (
                // eslint-disable-next-line @next/next/no-img-element -- local data: URL preview
                <img src={coverPreview} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-[10px] text-muted-foreground">No cover</span>
              )}
            </div>
            <div className="flex-1 space-y-2">
              <Label htmlFor="file">File (PDF or EPUB)</Label>
              <Input
                id="file"
                name="file"
                type="file"
                accept=".pdf,.epub,application/pdf,application/epub+zip"
                required
                onChange={onFileChange}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              name="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="author">Author</Label>
            <Input id="author" name="author" placeholder="Optional" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Input
              id="category"
              name="category"
              list="category-options"
              placeholder="e.g. Business"
            />
            <datalist id="category-options">
              {categories.map((category) => (
                <option key={category.id} value={category.name} />
              ))}
            </datalist>
          </div>

          {uploadProgress !== null && (
            <div className="space-y-1">
              <Progress value={uploadProgress * 100} className="h-1.5" />
              <p className="text-xs text-muted-foreground">
                Uploading… {Math.round(uploadProgress * 100)}%
              </p>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting || isReadingCover}>
              {isSubmitting ? "Uploading…" : "Add to shelf"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
