"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { Highlighter, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReaderScrubber, ReaderToolbar } from "@/components/readers/reader-toolbar";
import { ReaderPage, paperStyle } from "@/components/readers/reader-page";
import { NotesPanelToggle, ReaderNotesPanel, useBookAnnotations, useNotesPanelState } from "@/components/readers/reader-notes-panel";
import { BookmarkButton } from "@/components/readers/bookmark-button";
import { useReadingSession } from "@/hooks/use-reading-session";
import { useIntervalChime } from "@/hooks/use-interval-chime";
import { usePomodoro } from "@/hooks/use-pomodoro";
import { useProgressSync } from "@/hooks/use-progress-sync";
import { useDarkMode } from "@/hooks/use-dark-mode";
import { sendOrQueue } from "@/lib/offline-queue";
import { downloadBook, INITIAL_READER_LOAD, readerErrorState, type ReaderLoadState } from "@/lib/book-download";
import { ReaderLoadStatus } from "@/components/readers/reader-load-status";
import type { Preferences } from "@/lib/preferences";
import { MIN_SAMPLE_WORDS, countWords, formatTimeLeft, wordsPerMinute } from "@/lib/reading-speed";
import { chapterAt, tidyChapters, type ReaderChapter } from "@/lib/reader-chapters";

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.2;
const CONTAINER_PADDING = 32; // matches the p-4 wrapper around the canvas
const SWIPE_MIN_DISTANCE = 60;

type Rect = { x: number; y: number; width: number; height: number };
type HighlightAnnotation = { type: string; location: string; rects: Rect[] | null };
type OutlineItem = { title: string; dest: string | unknown[] | null; items: OutlineItem[] };

// PDF locations are page numbers.
function describePage(location: string) {
  return /^\d+$/.test(location) ? "Page " + location : null;
}

// Chapters from the PDF's outline (bookmarks), mapped to page numbers.
async function loadChapters(pdf: PDFDocumentProxy): Promise<ReaderChapter[]> {
  const outline = ((await pdf.getOutline().catch(() => null)) ?? []) as OutlineItem[];
  const items = outline.length > 1 ? outline : outline.flatMap((item) => [item, ...(item.items ?? [])]);
  const entries = await Promise.all(
    items.map(async (item) => {
      try {
        const dest = typeof item.dest === "string" ? await pdf.getDestination(item.dest) : item.dest;
        const ref = dest?.[0];
        if (ref === undefined || ref === null) return [];
        const pageIndex = typeof ref === "number" ? ref : await pdf.getPageIndex(ref as Parameters<PDFDocumentProxy["getPageIndex"]>[0]);
        return [{ label: item.title, start: pageIndex + 1, position: pageIndex / pdf.numPages }];
      } catch {
        return [];
      }
    })
  );
  return tidyChapters(entries.flat());
}

export function PdfReader({
  bookId,
  title,
  author,
  initialLocation,
  isFinished: initialIsFinished,
  dailyGoalMinutes,
  minutesBeforeSession,
  timer,
  averageWpm,
}: {
  bookId: string;
  title: string;
  author: string | null;
  initialLocation: string | null;
  isFinished: boolean;
  dailyGoalMinutes: number | null;
  minutesBeforeSession: number;
  timer: Preferences["timer"];
  // From past sessions; used until this session has measured enough.
  averageWpm: number | null;
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
  const [loadState, setLoadState] = useState<ReaderLoadState>(INITIAL_READER_LOAD);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const session = useReadingSession(bookId, { autoPauseMinutes: timer.autoPauseMinutes });
  const { markActivity, pageTurn, notePageWords } = session;
  // Word counts of pages rendered so far, for speed and time left.
  const pageWordsRef = useRef(new Map<number, number>());
  const previousPageRef = useRef<number | null>(null);
  const [wordsPerPage, setWordsPerPage] = useState<number | null>(null);
  useIntervalChime(session.elapsedSeconds, timer.chimeMinutes);
  const pomodoro = usePomodoro(session, { enabled: timer.pomodoro, focusMinutes: timer.focusMinutes, breakMinutes: timer.breakMinutes });
  const saveProgress = useProgressSync(bookId);
  const [notesOpen, setNotesOpen] = useNotesPanelState();
  const notesPanelId = useId();
  const closeNotes = useCallback(() => setNotesOpen(false), [setNotesOpen]);
  const { annotations, loading: annotationsLoading, remove: removeAnnotation } = useBookAnnotations(bookId, annotationsVersion);
  const [chapters, setChapters] = useState<ReaderChapter[]>([]);
  const dark = useDarkMode();

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    let loadingTask: ReturnType<typeof import("pdfjs-dist").getDocument> | undefined;

    async function load() {
      const bytes = await downloadBook(bookId, controller.signal, (state) => {
        if (!cancelled) setLoadState(state);
      });
      const pdfjsLib = await import("pdfjs-dist");
      if (cancelled) return;
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url
      ).toString();

      loadingTask = pdfjsLib.getDocument({ data: bytes });
      const pdf = await loadingTask.promise;
      if (cancelled) {
        pdf.loadingTask.destroy();
        return;
      }
      pdfRef.current = pdf;
      setPageNumber((page) => Math.min(Math.max(1, page), pdf.numPages));
      setNumPages(pdf.numPages);
      const found = await loadChapters(pdf);
      if (!cancelled) setChapters(found);
    }

    load().catch((error) => {
      if (!cancelled) setLoadState(readerErrorState(error));
    });
    return () => {
      cancelled = true;
      controller.abort();
      renderTaskRef.current?.cancel();
      void loadingTask?.destroy();
      pdfRef.current = null;
    };
  }, [bookId, loadAttempt]);

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
        div.style.background = "rgba(217, 119, 54, 0.35)";
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

      try {
        const pdfjsLib = await import("pdfjs-dist");
        const pdfPage = await pdf.getPage(page);
        if (pdfRef.current !== pdf) return;
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
        } catch (error) {
          if (pdfRef.current === pdf && (!(error instanceof Error) || error.name !== "RenderingCancelledException")) {
            setLoadState(readerErrorState(error));
          }
          return;
        } finally {
          if (renderTaskRef.current === task) renderTaskRef.current = null;
        }

        if (pdfRef.current !== pdf) return;

        textLayerEl.innerHTML = "";
        // pdf.js scales each span's font size by --total-scale-factor relative
        // to a size-1 base height, and sizes the layer itself via a round()
        // that needs --scale-round-x/y — without these the whole calc chain
        // is invalid and text collapses to the wrong size and position.
        textLayerEl.style.setProperty("--total-scale-factor", String(cssViewport.scale));
        textLayerEl.style.setProperty("--scale-round-x", "1px");
        textLayerEl.style.setProperty("--scale-round-y", "1px");
        const textContent = await pdfPage.getTextContent();
        const words = countWords(textContent.items.map((item) => ("str" in item ? item.str : "")).join(" "));
        if (!pageWordsRef.current.has(page)) {
          pageWordsRef.current.set(page, words);
          const counts = [...pageWordsRef.current.values()].filter((count) => count > 0);
          setWordsPerPage(counts.length ? Math.round(counts.reduce((sum, count) => sum + count, 0) / counts.length) : null);
        }
        if (page === previousPageRef.current) notePageWords(words);
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
        if (pdfRef.current === pdf) setLoadState({ phase: "ready" });
      } catch (error) {
        if (pdfRef.current === pdf) setLoadState(readerErrorState(error));
      }
    },
    [zoomLevel, notePageWords]
  );

  // A page turn is reading activity (for auto-pause).
  useEffect(() => {
    const previous = previousPageRef.current;
    previousPageRef.current = pageNumber;
    pageTurn(pageWordsRef.current.get(pageNumber) ?? null, previous !== null && pageNumber > previous);
  }, [pageNumber, pageTurn]);

  useEffect(() => {
    if (numPages === 0) return;
    void Promise.resolve().then(() => renderPage(pageNumber));
    saveProgress({
      location: String(pageNumber),
      percent: Math.round((pageNumber / numPages) * 10000) / 100,
    });
  }, [pageNumber, numPages, renderPage, saveProgress]);

  useEffect(() => {
    if (numPages === 0) return;
    void loadHighlights().catch(() => {}).then(() => renderPage(pageNumber));
    // Re-fetches when a new highlight is saved; page/renderPage changes are
    // already handled by the effect above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [annotationsVersion, loadHighlights, numPages]);

  // Re-fit the page whenever its container changes width: window resizes,
  // but also the sidebar collapsing or expanding.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let lastWidth = container.clientWidth;
    const observer = new ResizeObserver(() => {
      if (container.clientWidth === lastWidth) return;
      lastWidth = container.clientWidth;
      void renderPage(pageNumber);
    });
    observer.observe(container);
    return () => observer.disconnect();
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
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.target instanceof Element && event.target.closest("input, textarea, select, [contenteditable='true'], [role='dialog'], [role='slider']")) return;
      if (event.key === "ArrowRight") goToPage(pageNumber + 1);
      if (event.key === "ArrowLeft") goToPage(pageNumber - 1);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pageNumber, goToPage]);

  const wpm =
    session.speedSample.words >= MIN_SAMPLE_WORDS
      ? wordsPerMinute(session.speedSample.words, session.speedSample.seconds)
      : averageWpm;
  const place = chapterAt(chapters, pageNumber);
  // Time left in this chapter when the PDF has an outline, else in the book.
  const lastPage = place ? (place.next ? place.next.start - 1 : numPages) : numPages;
  const minutesLeft = wpm && wordsPerPage && numPages ? (Math.max(0, lastPage - pageNumber) * wordsPerPage) / wpm : null;
  const percent = numPages ? (pageNumber / numPages) * 100 : 0;
  const paper = dark ? { background: "#1a201c", color: "#e8e4dc", textured: false } : { background: "#faf7f2", color: "#1c1b1b", textured: true };

  async function markFinished() {
    const response = await fetch(`/api/books/${bookId}/finish`, { method: "POST" });
    if (response.ok) setIsFinished(true);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ReaderToolbar
        title={title}
        format="pdf"
        chapterLabel={place?.chapter.label ?? null}
        progressLabel={numPages ? `${Math.round(percent)}% (p. ${pageNumber}/${numPages})` : null}
        session={session}
        pomodoro={pomodoro}
        isFinished={isFinished}
        onMarkFinished={markFinished}
        dailyGoalMinutes={dailyGoalMinutes}
        minutesBeforeSession={minutesBeforeSession}
        trailing={
          <NotesPanelToggle
            open={notesOpen}
            onToggle={() => setNotesOpen(!notesOpen)}
            panelId={notesPanelId}
            count={annotations.filter((annotation) => annotation.type !== "bookmark").length}
          />
        }
      >
        <Button
          variant={highlightMode ? "default" : "ghost"}
          size="icon-sm"
          aria-label={highlightMode ? "Exit highlight mode" : "Enter highlight mode"}
          aria-pressed={highlightMode}
          title="Highlight mode"
          onClick={() => setHighlightMode((v) => !v)}
        >
          <Highlighter />
        </Button>
        <BookmarkButton
          bookId={bookId}
          getCurrentLocation={() => String(pageNumber)}
          onSaved={() => setAnnotationsVersion((v) => v + 1)}
        />
        <div className="ml-1 flex items-center rounded-lg bg-secondary" role="group" aria-label="Zoom">
          <Button variant="ghost" size="icon-sm" aria-label="Zoom out" onClick={() => changeZoom(-ZOOM_STEP)} disabled={zoomLevel <= MIN_ZOOM}>
            <ZoomOut />
          </Button>
          <span className="min-w-10 text-center text-[11px] font-semibold text-muted-foreground tabular-nums">{Math.round(zoomLevel * 100)}%</span>
          <Button variant="ghost" size="icon-sm" aria-label="Zoom in" onClick={() => changeZoom(ZOOM_STEP)} disabled={zoomLevel >= MAX_ZOOM}>
            <ZoomIn />
          </Button>
        </div>
      </ReaderToolbar>

      <div className="flex min-h-0 flex-1 gap-6 px-3 py-3 sm:px-6 sm:py-4">
        <ReaderPage
          caption={author}
          pageLabel={numPages ? String(pageNumber) : null}
          onPrev={() => goToPage(pageNumber - 1)}
          onNext={() => goToPage(pageNumber + 1)}
          canPrev={pageNumber > 1}
          canNext={numPages === 0 || pageNumber < numPages}
          className="min-w-0 flex-1"
          style={paperStyle(paper.background, paper.color, paper.textured)}
        >
          {/* Centred with auto margins rather than flex alignment: when the
              page is taller (or, zoomed, wider) than the view, flex centring
              pushes its top and left edges out of reach of the scrollbars. */}
          <div
            ref={containerRef}
            className="relative flex h-full overflow-auto p-4"
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            <ReaderLoadStatus state={loadState} onRetry={() => {
              setLoadState(INITIAL_READER_LOAD);
              setNumPages(0);
              setLoadAttempt((attempt) => attempt + 1);
            }} />
            <div className="relative m-auto">
              <canvas ref={canvasRef} className="rounded-sm shadow-[var(--shadow-lift)] ring-1 ring-border" />
              <div ref={highlightLayerRef} className="pointer-events-none absolute top-0 left-0" />
              <div ref={textLayerRef} className="pdf-text-layer absolute top-0 left-0" />
              {/* Mouse-only page-turn zones; keyboard users have the footer buttons and arrow keys. */}
              <button type="button" tabIndex={-1} aria-hidden="true" className="absolute inset-y-0 left-0 z-20 w-12 cursor-w-resize" onClick={() => goToPage(pageNumber - 1)} />
              <button type="button" tabIndex={-1} aria-hidden="true" className="absolute inset-y-0 right-0 z-20 w-12 cursor-e-resize" onClick={() => goToPage(pageNumber + 1)} />
            </div>
          </div>
        </ReaderPage>
        <ReaderNotesPanel
          id={notesPanelId}
          bookId={bookId}
          bookTitle={title}
          open={notesOpen}
          onClose={closeNotes}
          annotations={annotations}
          loading={annotationsLoading}
          onDelete={removeAnnotation}
          getCurrentLocation={() => String(pageNumber)}
          describeLocation={describePage}
          onJumpTo={(location) => goToPage(Number(location) || 1)}
          onSaved={() => setAnnotationsVersion((v) => v + 1)}
          onActivity={markActivity}
        />
      </div>

      <ReaderScrubber
        percent={percent}
        markers={chapters.flatMap((chapter) => (chapter.position !== null ? [{ label: chapter.label, percent: chapter.position * 100 }] : []))}
        onSeek={numPages ? (fraction) => goToPage(Math.min(numPages, Math.max(1, Math.round(fraction * numPages)))) : undefined}
        timeLeft={minutesLeft !== null ? `~${formatTimeLeft(minutesLeft)} left in ${place ? `chapter ${place.number}` : "book"}` : null}
        speed={wpm ? `${wpm} wpm` : null}
        chapter={place ? `${place.number} of ${place.count}` : null}
        position={numPages ? `Page ${pageNumber} of ${numPages}` : "Opening…"}
      />
    </div>
  );
}
