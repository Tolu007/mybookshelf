"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { ChevronLeft, ChevronRight, Highlighter, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReaderToolbar } from "@/components/readers/reader-toolbar";
import { AnnotationsPanel } from "@/components/readers/annotations-panel";
import { AddNoteButton } from "@/components/readers/add-note-button";
import { BookmarkButton } from "@/components/readers/bookmark-button";
import { useReadingSession } from "@/hooks/use-reading-session";
import { useProgressSync } from "@/hooks/use-progress-sync";
import { sendOrQueue } from "@/lib/offline-queue";

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.2;
const CONTAINER_PADDING = 32; // matches the p-4 wrapper around the canvas
const SWIPE_MIN_DISTANCE = 60;

type Rect = { x: number; y: number; width: number; height: number };
type HighlightAnnotation = { type: string; location: string; rects: Rect[] | null };

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
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const highlightLayerRef = useRef<HTMLDivElement>(null);
  const pdfRef = useRef<PDFDocumentProxy | null>(null);
  const highlightsRef = useRef<HighlightAnnotation[]>([]);
  const renderTaskRef = useRef<RenderTask | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(
    initialLocation ? Number(initialLocation) || 1 : 1
  );
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isFinished, setIsFinished] = useState(initialIsFinished);
  const [highlightMode, setHighlightMode] = useState(false);
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

  const loadHighlights = useCallback(async () => {
    const response = await fetch(`/api/books/${bookId}/annotations`);
    const data = await response.json().catch(() => ({}));
    highlightsRef.current = (data.annotations ?? []) as HighlightAnnotation[];
  }, [bookId]);

  function drawHighlights(page: number, width: number, height: number) {
    const layer = highlightLayerRef.current;
    if (!layer) return;
    layer.innerHTML = "";

    for (const highlight of highlightsRef.current) {
      if (highlight.type !== "highlight" || highlight.location !== String(page)) continue;
      for (const rect of highlight.rects ?? []) {
        const div = document.createElement("div");
        div.style.position = "absolute";
        div.style.left = `${rect.x * width}px`;
        div.style.top = `${rect.y * height}px`;
        div.style.width = `${rect.width * width}px`;
        div.style.height = `${rect.height * height}px`;
        div.style.background = "rgba(177, 80, 46, 0.35)";
        div.style.borderRadius = "2px";
        layer.appendChild(div);
      }
    }
  }

  // Fits the page to the available width by default, then applies the
  // user's zoom on top — rendered at device pixel ratio so zooming in on a
  // dense (e.g. multi-column) page stays crisp instead of blurring out.
  // Also lays an invisible, selectable text layer over the canvas (so you
  // can highlight text from what's otherwise just a raster image) and
  // redraws any saved highlights for this page.
  const renderPage = useCallback(
    async (page: number) => {
      const pdf = pdfRef.current;
      const canvas = canvasRef.current;
      const container = containerRef.current;
      const textLayerEl = textLayerRef.current;
      if (!pdf || !canvas || !container || !textLayerEl) return;

      const pdfjsLib = await import("pdfjs-dist");
      const pdfPage = await pdf.getPage(page);
      const nativeViewport = pdfPage.getViewport({ scale: 1 });
      const availableWidth = container.clientWidth - CONTAINER_PADDING;
      const fitScale = Math.max(0.1, availableWidth / nativeViewport.width);
      const displayScale = fitScale * zoomLevel;
      const dpr = window.devicePixelRatio || 1;

      const renderViewport = pdfPage.getViewport({ scale: displayScale * dpr });
      const cssViewport = pdfPage.getViewport({ scale: displayScale });

      canvas.width = renderViewport.width;
      canvas.height = renderViewport.height;
      canvas.style.width = `${cssViewport.width}px`;
      canvas.style.height = `${cssViewport.height}px`;

      // A zoom change or page turn can fire before the previous render of
      // this canvas finishes — pdf.js throws if two renders overlap, so
      // cancel whatever's in flight before starting a new one.
      renderTaskRef.current?.cancel();
      const task = pdfPage.render({ canvas, viewport: renderViewport });
      renderTaskRef.current = task;
      try {
        await task.promise;
      } catch {
        return;
      } finally {
        if (renderTaskRef.current === task) renderTaskRef.current = null;
      }

      textLayerEl.innerHTML = "";
      // pdf.js scales each span's font size by --total-scale-factor relative
      // to a size-1 base height, and sizes the layer itself via a round()
      // that needs --scale-round-x/y — without these the whole calc chain
      // is invalid and text collapses to the wrong size and position.
      textLayerEl.style.setProperty("--total-scale-factor", String(cssViewport.scale));
      textLayerEl.style.setProperty("--scale-round-x", "1px");
      textLayerEl.style.setProperty("--scale-round-y", "1px");
      const textContent = await pdfPage.getTextContent();
      const textLayer = new pdfjsLib.TextLayer({
        textContentSource: textContent,
        container: textLayerEl,
        viewport: cssViewport,
      });
      await textLayer.render();
      // The round() above can still land a fraction of a pixel off the
      // canvas — force an exact match so the highlight overlay (positioned
      // from plain fractions of this size) can't drift from the text layer.
      textLayerEl.style.width = `${cssViewport.width}px`;
      textLayerEl.style.height = `${cssViewport.height}px`;

      if (highlightLayerRef.current) {
        highlightLayerRef.current.style.width = `${cssViewport.width}px`;
        highlightLayerRef.current.style.height = `${cssViewport.height}px`;
      }
      drawHighlights(page, cssViewport.width, cssViewport.height);
    },
    [zoomLevel]
  );

  useEffect(() => {
    if (numPages === 0) return;
    renderPage(pageNumber);
    saveProgress({
      location: String(pageNumber),
      percent: Math.round((pageNumber / numPages) * 10000) / 100,
    });
  }, [pageNumber, numPages, renderPage, saveProgress]);

  useEffect(() => {
    if (numPages === 0) return;
    loadHighlights().then(() => renderPage(pageNumber));
    // Re-fetches when a new highlight is saved; page/renderPage changes are
    // already handled by the effect above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [annotationsVersion, loadHighlights, numPages]);

  useEffect(() => {
    function onResize() {
      renderPage(pageNumber);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [pageNumber, renderPage]);

  // Selecting text in the invisible layer saves it as a highlight, scoped to
  // this page, positioned as fractions of the display size so it stays
  // correctly placed at any zoom level.
  useEffect(() => {
    function onSelectionEnd() {
      if (!highlightMode) return;

      const selection = window.getSelection();
      const textLayerEl = textLayerRef.current;
      const canvas = canvasRef.current;
      if (!selection || selection.isCollapsed || selection.rangeCount === 0) return;
      if (!textLayerEl || !canvas) return;

      const range = selection.getRangeAt(0);
      if (!textLayerEl.contains(range.commonAncestorContainer)) return;

      const excerpt = selection.toString().trim();
      if (!excerpt) return;

      const canvasRect = canvas.getBoundingClientRect();
      const rects: Rect[] = Array.from(range.getClientRects())
        .filter((rect) => rect.width > 0 && rect.height > 0)
        .map((rect) => ({
          x: (rect.left - canvasRect.left) / canvasRect.width,
          y: (rect.top - canvasRect.top) / canvasRect.height,
          width: rect.width / canvasRect.width,
          height: rect.height / canvasRect.height,
        }));

      selection.removeAllRanges();
      if (rects.length === 0) return;

      sendOrQueue(`/api/books/${bookId}/annotations`, "POST", {
        type: "highlight",
        location: String(pageNumber),
        excerpt: excerpt.slice(0, 500),
        rects,
      }).then(() => setAnnotationsVersion((v) => v + 1));
    }

    document.addEventListener("mouseup", onSelectionEnd);
    document.addEventListener("touchend", onSelectionEnd);
    return () => {
      document.removeEventListener("mouseup", onSelectionEnd);
      document.removeEventListener("touchend", onSelectionEnd);
    };
  }, [bookId, pageNumber, highlightMode]);

  const goToPage = useCallback(
    (next: number) => {
      if (next < 1 || (numPages > 0 && next > numPages)) return;
      setPageNumber(next);
    },
    [numPages]
  );

  // Swipe to turn pages — only at the default fit-width zoom, and never
  // while highlight mode is on, so it can't hijack a pinch-zoom gesture, a
  // pan across a zoomed-in page, or a text-selection drag.
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  function onTouchStart(event: React.TouchEvent) {
    if (highlightMode || zoomLevel !== 1 || event.touches.length !== 1) {
      touchStartRef.current = null;
      return;
    }
    touchStartRef.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
  }

  function onTouchEnd(event: React.TouchEvent) {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;

    const touch = event.changedTouches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;

    if (Math.abs(dx) > SWIPE_MIN_DISTANCE && Math.abs(dx) > Math.abs(dy) * 1.5) {
      goToPage(dx < 0 ? pageNumber + 1 : pageNumber - 1);
    }
  }

  function changeZoom(delta: number) {
    setZoomLevel((z) => Math.round(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z + delta)) * 100) / 100);
  }

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
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => changeZoom(-ZOOM_STEP)}
          disabled={zoomLevel <= MIN_ZOOM}
        >
          <ZoomOut />
        </Button>
        <span className="text-sm text-muted-foreground tabular-nums">
          {Math.round(zoomLevel * 100)}%
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => changeZoom(ZOOM_STEP)}
          disabled={zoomLevel >= MAX_ZOOM}
        >
          <ZoomIn />
        </Button>
        <Button
          variant={highlightMode ? "default" : "ghost"}
          size="icon-sm"
          aria-label={highlightMode ? "Exit highlight mode" : "Enter highlight mode"}
          onClick={() => setHighlightMode((v) => !v)}
        >
          <Highlighter />
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
      <div
        ref={containerRef}
        className="flex flex-1 items-center justify-center overflow-auto bg-muted/30 p-4"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div className="relative">
          <canvas ref={canvasRef} className="rounded-sm shadow-lg" />
          <div ref={highlightLayerRef} className="pointer-events-none absolute top-0 left-0" />
          <div ref={textLayerRef} className="pdf-text-layer absolute top-0 left-0" />
          <button
            type="button"
            aria-label="Previous page"
            className="absolute inset-y-0 left-0 z-20 w-12 cursor-w-resize"
            onClick={() => goToPage(pageNumber - 1)}
          />
          <button
            type="button"
            aria-label="Next page"
            className="absolute inset-y-0 right-0 z-20 w-12 cursor-e-resize"
            onClick={() => goToPage(pageNumber + 1)}
          />
        </div>
      </div>
    </div>
  );
}
