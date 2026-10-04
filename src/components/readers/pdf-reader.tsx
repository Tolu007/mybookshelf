"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReaderToolbar } from "@/components/readers/reader-toolbar";
import { AnnotationsPanel } from "@/components/readers/annotations-panel";
import { AddNoteButton } from "@/components/readers/add-note-button";
import { BookmarkButton } from "@/components/readers/bookmark-button";
import { useReadingSession } from "@/hooks/use-reading-session";
import { useProgressSync } from "@/hooks/use-progress-sync";

export function PdfReader({
  bookId,
  title,
  initialLocation,
  isFinished: initialIsFinished,
}: {
  bookId: string;
  title: string;
  initialLocation: string | null;
  isFinished: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pdfRef = useRef<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(
    initialLocation ? Number(initialLocation) || 1 : 1
  );
  const [isFinished, setIsFinished] = useState(initialIsFinished);
  const [annotationsVersion, setAnnotationsVersion] = useState(0);
  const { elapsedSeconds } = useReadingSession(bookId);
  const saveProgress = useProgressSync(bookId);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url
      ).toString();

      const pdf = await pdfjsLib.getDocument({ url: `/api/books/${bookId}/file` }).promise;
      if (cancelled) {
        pdf.loadingTask.destroy();
        return;
      }
      pdfRef.current = pdf;
      setNumPages(pdf.numPages);
    }

    load();
    return () => {
      cancelled = true;
      pdfRef.current?.loadingTask.destroy();
    };
  }, [bookId]);

  const renderPage = useCallback(async (page: number) => {
    const pdf = pdfRef.current;
    const canvas = canvasRef.current;
    if (!pdf || !canvas) return;

    const pdfPage = await pdf.getPage(page);
    const viewport = pdfPage.getViewport({ scale: 1.5 });
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await pdfPage.render({ canvas, viewport }).promise;
  }, []);

  useEffect(() => {
    if (numPages === 0) return;
    renderPage(pageNumber);
    saveProgress({
      location: String(pageNumber),
      percent: Math.round((pageNumber / numPages) * 10000) / 100,
    });
  }, [pageNumber, numPages, renderPage, saveProgress]);

  const goToPage = useCallback(
    (next: number) => {
      if (next < 1 || (numPages > 0 && next > numPages)) return;
      setPageNumber(next);
    },
    [numPages]
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowRight") goToPage(pageNumber + 1);
      if (event.key === "ArrowLeft") goToPage(pageNumber - 1);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pageNumber, goToPage]);

  async function markFinished() {
    const response = await fetch(`/api/books/${bookId}/finish`, { method: "POST" });
    if (response.ok) setIsFinished(true);
  }

  return (
    <div className="flex h-full flex-col">
      <ReaderToolbar
        title={title}
        elapsedSeconds={elapsedSeconds}
        isFinished={isFinished}
        onMarkFinished={markFinished}
      >
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => goToPage(pageNumber - 1)}
          disabled={pageNumber <= 1}
        >
          <ChevronLeft />
        </Button>
        <span className="text-sm text-muted-foreground tabular-nums">
          {pageNumber} / {numPages || "…"}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => goToPage(pageNumber + 1)}
          disabled={numPages > 0 && pageNumber >= numPages}
        >
          <ChevronRight />
        </Button>
        <BookmarkButton
          bookId={bookId}
          getCurrentLocation={() => String(pageNumber)}
          onSaved={() => setAnnotationsVersion((v) => v + 1)}
        />
        <AddNoteButton
          bookId={bookId}
          getCurrentLocation={() => String(pageNumber)}
          onSaved={() => setAnnotationsVersion((v) => v + 1)}
        />
        <AnnotationsPanel
          bookId={bookId}
          refreshKey={annotationsVersion}
          onJumpTo={(location) => goToPage(Number(location) || 1)}
        />
      </ReaderToolbar>
      <div className="flex flex-1 items-center justify-center overflow-auto bg-muted/30 p-4">
        <canvas ref={canvasRef} className="rounded-sm shadow-lg" />
      </div>
    </div>
  );
}
