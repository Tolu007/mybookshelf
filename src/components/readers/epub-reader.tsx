"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Epub from "epubjs";
import type { Book, Contents, Rendition } from "epubjs";
import { Highlighter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReaderScrubber, ReaderToolbar } from "@/components/readers/reader-toolbar";
import { ReaderPage, paperStyle } from "@/components/readers/reader-page";
import { Typecraft } from "@/components/readers/typecraft";
import { NotesPanelToggle, ReaderNotesPanel, useBookAnnotations, useNotesPanelState } from "@/components/readers/reader-notes-panel";
import { BookmarkButton } from "@/components/readers/bookmark-button";
import { ReaderLoadStatus } from "@/components/readers/reader-load-status";
import { useReadingSession } from "@/hooks/use-reading-session";
import { useIntervalChime } from "@/hooks/use-interval-chime";
import { usePomodoro } from "@/hooks/use-pomodoro";
import { useProgressSync } from "@/hooks/use-progress-sync";
import { useDarkMode } from "@/hooks/use-dark-mode";
import { sendOrQueue } from "@/lib/offline-queue";
import { downloadBook, INITIAL_READER_LOAD, readerErrorState, type ReaderLoadState } from "@/lib/book-download";
import { PAPERS, READER_FONTS, columnWidthPx, readerFontStylesheet, type Preferences } from "@/lib/preferences";
import { MIN_SAMPLE_WORDS, countWords, formatTimeLeft, wordsPerMinute } from "@/lib/reading-speed";
import { chapterAt, chapterPositions, tidyChapters, type ReaderChapter } from "@/lib/reader-chapters";

const SWIPE_MIN_DISTANCE = 60;
// Horizontal padding inside the page card, on each side.
const PAGE_PADDING = 48;
const HIGHLIGHT_STYLE = { fill: "#d97736", "fill-opacity": "0.35", "mix-blend-mode": "multiply" };

type Typography = Preferences["reader"];

// The page's colours: a chosen paper, or "Match theme" following the app.
function paperFor(typography: Typography, dark: boolean) {
  const paper = PAPERS[typography.paper];
  if (paper.background && paper.color) {
    return { background: paper.background, color: paper.color, textured: typography.paper === "parchment" || typography.paper === "sepia", dark: typography.paper === "candle" || typography.paper === "obsidian" };
  }
  return dark
    ? { background: "#1a201c", color: "#e8e4dc", textured: false, dark: true }
    : { background: "#faf7f2", color: "#1c1b1b", textured: true, dark: false };
}

// CSS injected into every chapter's iframe. The body is transparent so the
// page card (and its paper texture) shows through. Line height and
// alignment go on text blocks with !important because most books set
// their own; on dark papers, text colours are forced so they stay legible.
function readerCss(typography: Typography, dark: boolean) {
  const paper = paperFor(typography, dark);
  return [
    `body { background: transparent !important; color: ${paper.color} !important; }`,
    `p, li, dd, blockquote { line-height: ${typography.lineHeight} !important;${typography.justify ? " text-align: justify !important; hyphens: auto; -webkit-hyphens: auto;" : ""} }`,
    paper.dark ? `p, li, dd, blockquote, h1, h2, h3, h4, h5, h6, span, a { color: inherit !important; }` : "",
  ].join("\n");
}

function applyTypography(rendition: Rendition, typography: Typography) {
  rendition.themes.font(READER_FONTS[typography.font].stack);
  rendition.themes.fontSize(`${typography.fontSize}px`);
  rendition.themes.registerCss("shelf", readerCss(typography, document.documentElement.classList.contains("dark")));
  // Selecting re-injects the theme, replacing the previous CSS.
  rendition.themes.select("shelf");
}

export function EpubReader({
  bookId,
  title,
  author,
  initialLocation,
  isFinished: initialIsFinished,
  dailyGoalMinutes,
  minutesBeforeSession,
  timer,
  averageWpm,
  preferences,
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
  // Saved settings: typography starts from these, and "Save as default"
  // writes back to them.
  preferences: Preferences;
}) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<Book | null>(null);
  const renditionRef = useRef<Rendition | null>(null);
  const currentCfiRef = useRef<string | null>(initialLocation);
  const highlightModeRef = useRef(false);
  const [typography, setTypography] = useState(preferences.reader);
  // The book loads once; typography changes are applied to it in place.
  const typographyRef = useRef(typography);
  const fontUrlRef = useRef(readerFontStylesheet(typography.font));
  const [isFinished, setIsFinished] = useState(initialIsFinished);
  const [highlightMode, setHighlightMode] = useState(false);
  const [annotationsVersion, setAnnotationsVersion] = useState(0);
  const [loadState, setLoadState] = useState<ReaderLoadState>(INITIAL_READER_LOAD);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [position, setPosition] = useState<{ percent: number; section: number; chapterPage: number | null; chapterPages: number | null; wordsPerPage: number | null }>({ percent: 0, section: 0, chapterPage: null, chapterPages: null, wordsPerPage: null });
  const [chapters, setChapters] = useState<ReaderChapter[]>([]);
  const dark = useDarkMode();
  const session = useReadingSession(bookId, { autoPauseMinutes: timer.autoPauseMinutes });
  const { markActivity, pageTurn } = session;
  useIntervalChime(session.elapsedSeconds, timer.chimeMinutes);
  const pomodoro = usePomodoro(session, { enabled: timer.pomodoro, focusMinutes: timer.focusMinutes, breakMinutes: timer.breakMinutes });
  // Page turns happen inside epub.js callbacks set up once per book.
  const pageTurnRef = useRef(pageTurn);
  const saveProgress = useProgressSync(bookId);
  const [notesOpen, setNotesOpen] = useNotesPanelState();
  const notesPanelId = useId();
  const closeNotes = useCallback(() => setNotesOpen(false), [setNotesOpen]);
  const { annotations, loading: annotationsLoading, remove: removeAnnotation } = useBookAnnotations(bookId, annotationsVersion);

  useEffect(() => {
    highlightModeRef.current = highlightMode;
  }, [highlightMode]);

  useEffect(() => {
    pageTurnRef.current = pageTurn;
  }, [pageTurn]);

  useEffect(() => {
    if (!viewerRef.current) return;

    let cancelled = false;
    const controller = new AbortController();
    const book = Epub();
    bookRef.current = book;
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
    rendition.hooks.content.register((contents: Contents) => contents.addStylesheet(fontUrlRef.current));
    applyTypography(rendition, typographyRef.current);
    const observer = new MutationObserver(() => applyTypography(rendition, typographyRef.current));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    // The text area changes size when the sidebar collapses, the notes
    // panel opens, the type changes or a chapter heading appears above the
    // text, not only when the window resizes. epub.js only creates its view
    // manager once the book is displayed.
    let displayed = false;
    const resizeObserver = new ResizeObserver(() => {
      const viewer = viewerRef.current;
      if (cancelled || !displayed || !viewer) return;
      rendition.resize(viewer.clientWidth, viewer.clientHeight);
    });
    resizeObserver.observe(viewerRef.current);

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

    // EPUBs have no fixed pages, so a page's words are estimated as the
    // chapter's words over its pages at the current layout.
    const sectionWords = new Map<string, number>();
    let previousPage: { index: number; page: number } | null = null;

    rendition.on(
      "relocated",
      (location: { start: { cfi: string; percentage: number; href?: string; index?: number; displayed?: { page: number; total: number } } }) => {
        currentCfiRef.current = location.start.cfi;
        const { href, index = 0, displayed } = location.start;
        const chapterWords = href ? sectionWords.get(href) : undefined;
        const wordsPerPage = chapterWords !== undefined && displayed?.total ? Math.round(chapterWords / displayed.total) : null;
        const page = displayed?.page ?? 0;
        const forward = previousPage !== null && (index > previousPage.index || (index === previousPage.index && page > previousPage.page));
        previousPage = { index, page };
        pageTurnRef.current(wordsPerPage, forward);
        const percent = Math.round(location.start.percentage * 10000) / 100;
        const locationsReady = book.locations.length() > 0;
        setPosition((value) => ({
          // Before locations are generated epub.js reports 0%; keep the last known value.
          percent: locationsReady ? percent : value.percent,
          section: index,
          chapterPage: displayed?.page ?? null,
          chapterPages: displayed?.total ?? null,
          wordsPerPage,
        }));
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
    rendition.on("rendered", (section: { href?: string }, view: { document?: Document }) => {
      const doc = view?.document;
      if (!doc) return;
      if (section?.href) sectionWords.set(section.href, countWords(doc.body?.textContent ?? ""));

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

    // Chapters come from the table of contents (top level, or one level
    // down for books that wrap everything in a single entry). Their
    // positions on the progress line, and book-wide percentages, need
    // generated locations.
    book.ready
      .then(() => {
        const toc = book.navigation?.toc ?? [];
        const entries = toc.length > 1 ? toc : toc.flatMap((item) => [item, ...(item.subitems ?? [])]);
        const found = entries.flatMap((item) => {
          const section = book.spine.get(item.href.split("#")[0]);
          return section ? [{ label: item.label, start: section.index, cfiBase: section.cfiBase }] : [];
        });
        const list = tidyChapters(found);
        if (!cancelled) setChapters(list);
        return book.locations.generate(1600).then(() => {
          if (cancelled) return;
          const cfiBaseByStart = new Map(found.map((chapter) => [chapter.start, chapter.cfiBase]));
          const positions = chapterPositions(JSON.parse(book.locations.save()) as string[], list.map((chapter) => cfiBaseByStart.get(chapter.start) ?? ""));
          setChapters(list.map((chapter, index) => ({ ...chapter, position: positions[index] })));
          if (currentCfiRef.current) {
            const percent = Math.round(book.locations.percentageFromCfi(currentCfiRef.current) * 10000) / 100;
            setPosition((value) => ({ ...value, percent }));
          }
        });
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
      bookRef.current = null;
    };
  }, [bookId, initialLocation, saveProgress, loadAttempt]);

  // Live typesetting from Typecraft.
  useEffect(() => {
    typographyRef.current = typography;
    fontUrlRef.current = readerFontStylesheet(typography.font);
    const rendition = renditionRef.current;
    if (!rendition) return;
    for (const contents of rendition.getContents() as unknown as Contents[]) {
      void contents.addStylesheet(fontUrlRef.current);
    }
    applyTypography(rendition, typography);
  }, [typography]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.target instanceof Element && event.target.closest("input, textarea, select, [contenteditable='true'], [role='dialog'], [role='slider']")) return;
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

  async function saveTypographyAsDefault() {
    const response = await fetch("/api/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preferences: { ...preferences, reader: typography } }),
    }).catch(() => null);
    return Boolean(response?.ok);
  }

  function seek(fraction: number) {
    const book = bookRef.current;
    if (!book || book.locations.length() === 0) return;
    void renditionRef.current?.display(book.locations.cfiFromPercentage(fraction));
  }

  const paper = paperFor(typography, dark);
  const place = chapterAt(chapters, position.section);
  const wpm =
    session.speedSample.words >= MIN_SAMPLE_WORDS
      ? wordsPerMinute(session.speedSample.words, session.speedSample.seconds)
      : averageWpm;
  const chapterMinutesLeft =
    wpm && position.wordsPerPage && position.chapterPage && position.chapterPages
      ? ((position.chapterPages - position.chapterPage) * position.wordsPerPage) / wpm
      : null;
  const chapterPageLabel = position.chapterPage && position.chapterPages ? `${position.chapterPage}/${position.chapterPages}` : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ReaderToolbar
        title={title}
        format="epub"
        chapterLabel={place?.chapter.label ?? null}
        progressLabel={`${Math.round(position.percent)}%${chapterPageLabel ? ` (p. ${chapterPageLabel})` : ""}`}
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
          getCurrentLocation={() => currentCfiRef.current ?? ""}
          onSaved={() => setAnnotationsVersion((v) => v + 1)}
        />
        <Typecraft
          typography={typography}
          onChange={(patch) => setTypography((value) => ({ ...value, ...patch }))}
          onSaveDefault={saveTypographyAsDefault}
        />
      </ReaderToolbar>

      <div className="flex min-h-0 flex-1 gap-6 px-3 py-3 sm:px-6 sm:py-4">
        <div className="relative flex min-h-0 min-w-0 flex-1 justify-center">
          <ReaderLoadStatus state={loadState} onRetry={() => {
            setLoadState(INITIAL_READER_LOAD);
            setLoadAttempt((attempt) => attempt + 1);
          }} />
          <div ref={frameRef} className="h-full w-full" style={{ maxWidth: columnWidthPx(typography.measure, typography.fontSize) + PAGE_PADDING * 2 }}>
            <ReaderPage
              eyebrow={place ? place.chapter.label : null}
              caption={author}
              pageLabel={chapterPageLabel}
              onPrev={() => renditionRef.current?.prev()}
              onNext={() => renditionRef.current?.next()}
              style={paperStyle(paper.background, paper.color, paper.textured)}
            >
              {/* Mouse-only page-turn zones; keyboard users have the footer buttons and arrow keys. */}
              <button type="button" tabIndex={-1} aria-hidden="true" className="absolute inset-y-0 left-0 z-10 w-12 cursor-w-resize" onClick={() => renditionRef.current?.prev()} />
              <div className="h-full px-6 py-4 sm:px-12 sm:py-6">
                <div ref={viewerRef} className="h-full" />
              </div>
              <button type="button" tabIndex={-1} aria-hidden="true" className="absolute inset-y-0 right-0 z-10 w-12 cursor-e-resize" onClick={() => renditionRef.current?.next()} />
            </ReaderPage>
          </div>
        </div>
        <ReaderNotesPanel
          id={notesPanelId}
          bookId={bookId}
          bookTitle={title}
          open={notesOpen}
          onClose={closeNotes}
          annotations={annotations}
          loading={annotationsLoading}
          onDelete={removeAnnotation}
          getCurrentLocation={() => currentCfiRef.current ?? ""}
          describeLocation={() => null}
          onJumpTo={(location) => renditionRef.current?.display(location)}
          onSaved={() => setAnnotationsVersion((v) => v + 1)}
          onActivity={markActivity}
        />
      </div>

      <ReaderScrubber
        percent={position.percent}
        markers={chapters.flatMap((chapter) => (chapter.position !== null ? [{ label: chapter.label, percent: chapter.position * 100 }] : []))}
        onSeek={seek}
        timeLeft={chapterMinutesLeft !== null ? `~${formatTimeLeft(chapterMinutesLeft)} left in ${place ? `chapter ${place.number}` : "this chapter"}` : null}
        speed={wpm ? `${wpm} wpm` : null}
        chapter={place ? `${place.number} of ${place.count}` : null}
        position={chapterPageLabel ? `Page ${position.chapterPage} of ${position.chapterPages} in chapter` : `${Math.round(position.percent)}% of book`}
      />
    </div>
  );
}
