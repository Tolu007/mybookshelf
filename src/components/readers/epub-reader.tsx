"use client";

import { useEffect, useRef, useState } from "react";
import Epub from "epubjs";
import type { Rendition } from "epubjs";
import { Highlighter, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReaderProgress, ReaderToolbar } from "@/components/readers/reader-toolbar";
import { AnnotationsPanel } from "@/components/readers/annotations-panel";
import { AddNoteButton } from "@/components/readers/add-note-button";
import { BookmarkButton } from "@/components/readers/bookmark-button";
import { useReadingSession } from "@/hooks/use-reading-session";
import { useIntervalChime } from "@/hooks/use-interval-chime";
import { useProgressSync } from "@/hooks/use-progress-sync";
import { sendOrQueue } from "@/lib/offline-queue";
import { downloadBook, INITIAL_READER_LOAD, readerErrorState, type ReaderLoadState } from "@/lib/book-download";
import { ReaderLoadStatus } from "@/components/readers/reader-load-status";
import { FONT_SIZE_RANGE, PAPERS, READER_FONTS, columnWidthPx, readerFontStylesheet, type Preferences } from "@/lib/preferences";
import { cn } from "@/lib/utils";

const SWIPE_MIN_DISTANCE = 60;
// Horizontal padding inside the page card, on each side.
const PAGE_PADDING = 48;
const HIGHLIGHT_STYLE = { fill: "#d97736", "fill-opacity": "0.35", "mix-blend-mode": "multiply" };

// "Match theme" paper follows the app's light/dark mode.
const AUTO_PAPER = {
  light: { background: "#fdfbf7", color: "#1c1b1b" },
  dark: { background: "#121614", color: "#e8e4dc" },
};

type Typography = Preferences["reader"];

// Rules injected into every chapter's iframe. Line height and alignment go
// on text blocks with !important because most books set their own.
function themeRules(colors: { background: string; color: string }, typography: Typography) {
  const text: Record<string, string> = { "line-height": `${typography.lineHeight} !important` };
  if (typography.justify) {
    text["text-align"] = "justify !important";
    text["hyphens"] = "auto";
    text["-webkit-hyphens"] = "auto";
  }
  return {
    body: { background: colors.background, color: colors.color },
    "p, li, dd, blockquote": text,
  };
}

export function EpubReader({
  bookId,
  title,
  initialLocation,
  isFinished: initialIsFinished,
  dailyGoalMinutes,
  minutesBeforeSession,
  timer,
  typography,
}: {
  bookId: string;
  title: string;
  initialLocation: string | null;
  isFinished: boolean;
  dailyGoalMinutes: number | null;
  minutesBeforeSession: number;
  timer: Preferences["timer"];
  typography: Typography;
}) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const renditionRef = useRef<Rendition | null>(null);
  const currentCfiRef = useRef<string | null>(initialLocation);
  const highlightModeRef = useRef(false);
  // Typography is fixed for the life of the reader (it's changed in
  // Settings), so read it from a ref instead of reloading the book.
  const typographyRef = useRef(typography);
  const [isFinished, setIsFinished] = useState(initialIsFinished);
  const [fontSize, setFontSize] = useState(typography.fontSize);
  const [highlightMode, setHighlightMode] = useState(false);
  const [annotationsVersion, setAnnotationsVersion] = useState(0);
  const [loadState, setLoadState] = useState<ReaderLoadState>(INITIAL_READER_LOAD);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [position, setPosition] = useState<{ percent: number; chapterPage: number | null; chapterPages: number | null }>({ percent: 0, chapterPage: null, chapterPages: null });
  const session = useReadingSession(bookId, { autoPauseMinutes: timer.autoPauseMinutes });
  const { markActivity } = session;
  useIntervalChime(session.elapsedSeconds, timer.chimeMinutes);
  // Page turns happen inside epub.js callbacks set up once per book.
  const markActivityRef = useRef(markActivity);
  const saveProgress = useProgressSync(bookId);

  useEffect(() => {
    highlightModeRef.current = highlightMode;
  }, [highlightMode]);

  useEffect(() => {
    markActivityRef.current = markActivity;
  }, [markActivity]);

  useEffect(() => {
    if (!viewerRef.current) return;

    let cancelled = false;
    const controller = new AbortController();
    const settings = typographyRef.current;
    const book = Epub();
    const rendition = book.renderTo(viewerRef.current, {
      width: "100%",
      height: "100%",
      flow: "paginated",
      spread: "none",
    });
    renditionRef.current = rendition;
    // epub.js emits this event without rejecting display() for some failures.
    rendition.on("displayError", (error: unknown) => {
      if (!cancelled) setLoadState(readerErrorState(error));
    });

    // Each chapter is its own iframe and can't see the app's fonts.
    const fontUrl = readerFontStylesheet(settings.font);
    rendition.hooks.content.register((contents: { addStylesheet: (url: string) => Promise<boolean> }) => contents.addStylesheet(fontUrl));
    rendition.themes.font(READER_FONTS[settings.font].stack);
    rendition.themes.fontSize(`${settings.fontSize}px`);

    const paper = PAPERS[settings.paper];
    if (paper.background && paper.color) {
      rendition.themes.register("paper", themeRules({ background: paper.background, color: paper.color }, settings));
    }
    rendition.themes.register("light", themeRules(AUTO_PAPER.light, settings));
    rendition.themes.register("dark", themeRules(AUTO_PAPER.dark, settings));

    function applyTheme() {
      if (paper.background) {
        rendition.themes.select("paper");
        return;
      }
      rendition.themes.select(
        document.documentElement.classList.contains("dark") ? "dark" : "light"
      );
    }
    applyTheme();
    const observer = new MutationObserver(applyTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    // The page card changes width when the sidebar collapses or the font
    // size changes, not only when the window resizes. epub.js only creates
    // its view manager once the book is displayed, so wait for that.
    let displayed = false;
    const resizeObserver = new ResizeObserver(() => {
      const viewer = viewerRef.current;
      if (cancelled || !displayed || !viewer) return;
      rendition.resize(viewer.clientWidth, viewer.clientHeight);
    });
    if (frameRef.current) resizeObserver.observe(frameRef.current);

    async function load() {
      const bytes = await downloadBook(bookId, controller.signal, (state) => {
        if (!cancelled) setLoadState(state);
      });
      if (cancelled) return;
      await book.open(bytes, "binary");
      if (cancelled) return;
      await rendition.display(initialLocation ?? undefined);
      displayed = true;
      if (!cancelled) setLoadState({ phase: "ready" });
    }
    load().catch((error) => {
      if (!cancelled) setLoadState(readerErrorState(error));
    });

    rendition.on(
      "relocated",
      (location: { start: { cfi: string; percentage: number; displayed?: { page: number; total: number } } }) => {
        currentCfiRef.current = location.start.cfi;
        markActivityRef.current();
        const percent = Math.round(location.start.percentage * 10000) / 100;
        setPosition({
          percent,
          chapterPage: location.start.displayed?.page ?? null,
          chapterPages: location.start.displayed?.total ?? null,
        });
        saveProgress({
          location: location.start.cfi,
          percent,
        });
      }
    );

    rendition.on("selected", (cfiRange: string, contents: { window: Window }) => {
      if (!highlightModeRef.current) return;

      const selectedText = contents.window.getSelection()?.toString().trim();
      if (!selectedText) return;

      rendition.annotations.highlight(cfiRange, {}, undefined, "shelf-highlight", HIGHLIGHT_STYLE);
      contents.window.getSelection()?.removeAllRanges();

      sendOrQueue(`/api/books/${bookId}/annotations`, "POST", {
        type: "highlight",
        location: cfiRange,
        excerpt: selectedText.slice(0, 500),
      }).then(() => setAnnotationsVersion((v) => v + 1));
    });

    // epub.js renders each section into its own iframe with its own document,
    // so swipe must be wired up fresh every time a new one is rendered —
    // touch events inside it never reach listeners on the outer page.
    rendition.on("rendered", (_section: unknown, view: { document?: Document }) => {
      const doc = view?.document;
      if (!doc) return;

      let start: { x: number; y: number } | null = null;

      function onTouchStart(event: TouchEvent) {
        if (highlightModeRef.current || event.touches.length !== 1) {
          start = null;
          return;
        }
        start = { x: event.touches[0].clientX, y: event.touches[0].clientY };
      }

      function onTouchEnd(event: TouchEvent) {
        if (!start) return;
        const touch = event.changedTouches[0];
        const dx = touch.clientX - start.x;
        const dy = touch.clientY - start.y;
        start = null;

        if (Math.abs(dx) > SWIPE_MIN_DISTANCE && Math.abs(dx) > Math.abs(dy) * 1.5) {
          if (dx < 0) rendition.next();
          else rendition.prev();
        }
      }

      doc.addEventListener("touchstart", onTouchStart);
      doc.addEventListener("touchend", onTouchEnd);
    });

    // Book-wide percentages need generated locations; until then the
    // first "relocated" reports 0%, so fill it in once they're ready.
    book.ready
      .then(() => book.locations.generate(1600))
      .then(() => {
        if (cancelled || !currentCfiRef.current) return;
        const percent = Math.round(book.locations.percentageFromCfi(currentCfiRef.current) * 10000) / 100;
        setPosition((value) => ({ ...value, percent }));
      })
      .catch(() => {});

    fetch(`/api/books/${bookId}/annotations`)
      .then((res) => res.json())
      .then((data: { annotations?: { type: string; location: string }[] }) => {
        for (const annotation of data.annotations ?? []) {
          if (annotation.type === "highlight") {
            rendition.annotations.highlight(annotation.location, {}, undefined, "shelf-highlight", HIGHLIGHT_STYLE);
          }
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      controller.abort();
      observer.disconnect();
      resizeObserver.disconnect();
      rendition.destroy();
      book.destroy();
      renditionRef.current = null;
    };
  }, [bookId, initialLocation, saveProgress, loadAttempt]);

  function changeFontSize(delta: number) {
    const next = Math.min(FONT_SIZE_RANGE.max, Math.max(FONT_SIZE_RANGE.min, fontSize + delta));
    setFontSize(next);
    renditionRef.current?.themes.fontSize(`${next}px`);
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.target instanceof Element && event.target.closest("input, textarea, select, [contenteditable='true'], [role='dialog']")) return;
      if (event.key === "ArrowRight") renditionRef.current?.next();
      if (event.key === "ArrowLeft") renditionRef.current?.prev();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  async function markFinished() {
    const response = await fetch(`/api/books/${bookId}/finish`, { method: "POST" });
    if (response.ok) setIsFinished(true);
  }

  const paper = PAPERS[typography.paper];
  const progressLabel = [
    position.chapterPage && position.chapterPages ? `Page ${position.chapterPage} of ${position.chapterPages} in chapter` : null,
    `${Math.round(position.percent)}% of book`,
  ].filter(Boolean).join(" · ");

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ReaderToolbar
        title={title}
        format="epub"
        session={session}
        isFinished={isFinished}
        onMarkFinished={markFinished}
        dailyGoalMinutes={dailyGoalMinutes}
        minutesBeforeSession={minutesBeforeSession}
      >
        <Button variant="ghost" size="icon-sm" aria-label="Decrease font size" disabled={fontSize <= FONT_SIZE_RANGE.min} onClick={() => changeFontSize(-1)}>
          <Minus />
        </Button>
        <span className="min-w-12 text-center text-xs font-semibold text-muted-foreground tabular-nums">{fontSize}px</span>
        <Button variant="ghost" size="icon-sm" aria-label="Increase font size" disabled={fontSize >= FONT_SIZE_RANGE.max} onClick={() => changeFontSize(1)}>
          <Plus />
        </Button>
        <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
        <Button
          variant={highlightMode ? "default" : "ghost"}
          size="icon-sm"
          aria-label={highlightMode ? "Exit highlight mode" : "Enter highlight mode"}
          aria-pressed={highlightMode}
          onClick={() => setHighlightMode((v) => !v)}
        >
          <Highlighter />
        </Button>
        <BookmarkButton
          bookId={bookId}
          getCurrentLocation={() => currentCfiRef.current ?? ""}
          onSaved={() => setAnnotationsVersion((v) => v + 1)}
        />
        <AddNoteButton
          bookId={bookId}
          getCurrentLocation={() => currentCfiRef.current ?? ""}
          onSaved={() => setAnnotationsVersion((v) => v + 1)}
        />
        <AnnotationsPanel
          bookId={bookId}
          refreshKey={annotationsVersion}
          onJumpTo={(location) => renditionRef.current?.display(location)}
        />
      </ReaderToolbar>
      <div className="relative flex min-h-0 flex-1 justify-center overflow-hidden bg-secondary/60 sm:px-6 sm:py-6">
        <ReaderLoadStatus state={loadState} onRetry={() => {
          setLoadState(INITIAL_READER_LOAD);
          setLoadAttempt((attempt) => attempt + 1);
        }} />
        <div
          ref={frameRef}
          className={cn(
            "relative h-full w-full overflow-hidden sm:rounded-lg sm:border sm:border-border sm:shadow-[var(--shadow-card)]",
            !paper.background && "bg-[#fdfbf7] dark:bg-[#121614]"
          )}
          style={{
            maxWidth: columnWidthPx(typography.measure, fontSize) + PAGE_PADDING * 2,
            ...(paper.background ? { background: paper.background } : {}),
          }}
        >
          <button
            type="button"
            aria-label="Previous page"
            className="absolute inset-y-0 left-0 z-10 w-12 cursor-w-resize"
            onClick={() => renditionRef.current?.prev()}
          />
          <div className="h-full px-5 py-6 sm:px-12 sm:py-10">
            <div ref={viewerRef} className="h-full" />
          </div>
          <button
            type="button"
            aria-label="Next page"
            className="absolute inset-y-0 right-0 z-10 w-12 cursor-e-resize"
            onClick={() => renditionRef.current?.next()}
          />
        </div>
      </div>
      <ReaderProgress percent={position.percent} label={progressLabel} />
    </div>
  );
}
