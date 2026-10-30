"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BookPlus, CheckCircle2, CloudUpload, FileText, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { extractClientCover } from "@/lib/extract-cover";
import { detectBookFormat, type BookFormat } from "@/lib/book-format";
import { cn } from "@/lib/utils";
import { formatBytes } from "@/lib/bytes";

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

export function AddBookDialog({
  categories,
  compact = false,
  triggerClassName,
}: {
  categories: { id: string; name: string }[];
  // Icon-only trigger for the collapsed sidebar rail.
  compact?: boolean;
  triggerClassName?: string;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [selected, setSelected] = useState<{ name: string; size: number; format: BookFormat | null } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [isReadingCover, setIsReadingCover] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function chooseFile(file: File | undefined) {
    if (!file) return;
    const format = detectBookFormat(file.name, file.type);
    setSelected({ name: file.name, size: file.size, format });
    setError(format ? null : "Only PDF and EPUB files are supported.");

    if (!title) {
      setTitle(file.name.replace(/\.(pdf|epub)$/i, ""));
    }

    setCoverPreview(null);
    if (!format) return;
    setIsReadingCover(true);
    const cover = await extractClientCover(file, format);
    setIsReadingCover(false);
    setCoverPreview(cover);
  }

  function onDrop(event: React.DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    const files = event.dataTransfer.files;
    if (!files.length || !fileInputRef.current || isSubmitting) return;
    // Hand the dropped file to the real input so the form submits it.
    fileInputRef.current.files = files;
    void chooseFile(files[0]);
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
        throw new Error("Choose a PDF or EPUB file first.");
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
      setSelected(null);
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
    <Dialog open={open} onOpenChange={(next) => { if (!isSubmitting) setOpen(next); }}>
      <DialogTrigger
        render={
          <Button
            size={compact ? "icon-lg" : "default"}
            aria-label={compact ? "Upload book" : undefined}
            title={compact ? "Upload book" : undefined}
            className={cn("border-primary/25 shadow-sm", triggerClassName)}
          />
        }
      >
        <Upload /> {!compact && "Upload book"}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <form ref={formRef} onSubmit={onSubmit} className="space-y-5">
          <DialogHeader>
            <p className="eyebrow flex items-center gap-1.5"><BookPlus className="size-3.5" aria-hidden="true" /> Add to your library</p>
            <DialogTitle>Add a new book</DialogTitle>
            <DialogDescription>
              Upload a PDF or EPUB. It&apos;s kept in the &ldquo;Shelf Library&rdquo; folder in your Google Drive.
            </DialogDescription>
          </DialogHeader>

          <label
            htmlFor="book-file"
            onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cn(
              "group flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-card px-5 py-7 text-center transition-colors hover:border-sage/50 hover:bg-secondary has-focus-visible:border-sage has-focus-visible:ring-3 has-focus-visible:ring-primary/15",
              dragging && "border-sage/60 bg-secondary"
            )}
          >
            <span className="flex size-12 items-center justify-center rounded-full border border-border bg-background text-sage transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
              <CloudUpload className="size-5" aria-hidden="true" />
            </span>
            <span className="font-heading text-lg leading-6">
              Drag &amp; drop a book here, or <span className="text-sage underline underline-offset-2">browse files</span>
            </span>
            <span className="meta">PDF or EPUB</span>
            {selected && (
              <span className="mt-1 flex max-w-full items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-xs">
                <FileText className="size-3.5 shrink-0 text-sage" aria-hidden="true" />
                <span className="truncate font-medium">{selected.name}</span>
                <span className="shrink-0 text-muted-foreground">({formatBytes(selected.size)})</span>
                {selected.format && <CheckCircle2 className="size-3.5 shrink-0 text-sage" aria-label="Supported file" />}
              </span>
            )}
            <input
              ref={fileInputRef}
              id="book-file"
              name="file"
              type="file"
              accept=".pdf,.epub,application/pdf,application/epub+zip"
              required
              disabled={isSubmitting}
              onChange={(event) => void chooseFile(event.target.files?.[0])}
              className="sr-only"
            />
          </label>

          <div className="flex gap-4">
            <div className="flex aspect-2/3 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-well sm:w-24">
              {isReadingCover ? (
                <span className="text-[10px] text-muted-foreground">Reading…</span>
              ) : coverPreview ? (
                // eslint-disable-next-line @next/next/no-img-element -- local data: URL preview
                <img src={coverPreview} alt="Cover preview" className="h-full w-full object-cover" />
              ) : (
                <span className="px-2 text-center text-[10px] text-muted-foreground">Cover appears here</span>
              )}
            </div>
            <div className="grid min-w-0 flex-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="title" className="meta">Book title</Label>
                <Input id="title" name="title" value={title} onChange={(e) => setTitle(e.target.value)} required disabled={isSubmitting} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="author" className="meta">Author</Label>
                <Input id="author" name="author" placeholder="Optional" disabled={isSubmitting} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="category" className="meta">Category / shelf</Label>
                <Input id="category" name="category" list="category-options" placeholder="e.g. Philosophy" disabled={isSubmitting} />
                <datalist id="category-options">
                  {categories.map((category) => (
                    <option key={category.id} value={category.name} />
                  ))}
                </datalist>
              </div>
              <div className="space-y-1.5">
                <span className="meta block">Format</span>
                <div className="flex gap-1.5" aria-live="polite">
                  {(["epub", "pdf"] as const).map((format) => (
                    <span
                      key={format}
                      className={cn(
                        "flex h-10 flex-1 items-center justify-center rounded-lg border text-xs font-semibold tracking-[0.04em] uppercase",
                        selected?.format === format ? "border-primary/30 bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"
                      )}
                    >
                      {format}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {uploadProgress !== null && (
            <div className="space-y-1.5" role="status">
              <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                <div className="h-full rounded-full bg-ribbon transition-[width]" style={{ width: `${Math.round(uploadProgress * 100)}%` }} />
              </div>
              <p className="meta">Uploading… {Math.round(uploadProgress * 100)}%</p>
            </div>
          )}

          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

          <DialogFooter className="sm:justify-between">
            <DialogClose render={<Button type="button" variant="ghost" disabled={isSubmitting} />}>Cancel</DialogClose>
            <Button type="submit" disabled={isSubmitting || isReadingCover || selected?.format === null}>
              <BookPlus /> {isSubmitting ? "Uploading…" : "Add to library"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
