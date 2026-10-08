"use client";

import { useEffect, useRef, useState } from "react";
import Epub from "epubjs";
import type { Rendition } from "epubjs";
import { Highlighter, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReaderToolbar } from "@/components/readers/reader-toolbar";
import { AnnotationsPanel } from "@/components/readers/annotations-panel";
import { AddNoteButton } from "@/components/readers/add-note-button";
import { BookmarkButton } from "@/components/readers/bookmark-button";
import { useReadingSession } from "@/hooks/use-reading-session";
import { useProgressSync } from "@/hooks/use-progress-sync";
import { sendOrQueue } from "@/lib/offline-queue";

const MIN_FONT_PERCENT = 80;
const MAX_FONT_PERCENT = 160;
const FONT_STEP = 10;
const MOBILE_BREAKPOINT = 768;
const SWIPE_MIN_DISTANCE = 60;

function spreadForWidth(width: number) {
  return width < MOBILE_BREAKPOINT ? "none" : "auto";
}

export function EpubReader({
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
  const viewerRef = useRef<HTMLDivElement>(null);
  const renditionRef = useRef<Rendition | null>(null);
  const currentCfiRef = useRef<string | null>(initialLocation);
  const highlightModeRef = useRef(false);
  const [isFinished, setIsFinished] = useState(initialIsFinished);
  const [fontPercent, setFontPercent] = useState(100);
  const [highlightMode, setHighlightMode] = useState(false);
  const [annotationsVersion, setAnnotationsVersion] = useState(0);
  const { elapsedSeconds } = useReadingSession(bookId);
  const saveProgress = useProgressSync(bookId);

  useEffect(() => {
    highlightModeRef.current = highlightMode;
  }, [highlightMode]);

  useEffect(() => {
    if (!viewerRef.current) return;

    // epub.js guesses the source type from the URL's file extension, and our
    // file route has none — without `openAs` it assumes this is a directory
    // of already-unzipped files and tries to fetch container.xml etc. as
    // separate requests, which silently fails to render anything at all.
    const book = Epub(`/api/books/${bookId}/file`, { openAs: "epub" });
    const rendition = book.renderTo(viewerRef.current, {
      width: "100%",
      height: "100%",
      flow: "paginated",
      spread: spreadForWidth(window.innerWidth),
    });
    renditionRef.current = rendition;

    function handleResize() {
      rendition.spread(spreadForWidth(window.innerWidth));
    }
    window.addEventListener("resize", handleResize);

    rendition.themes.register("light", {
      body: { background: "#fbf7f0", color: "#2b2420" },
    });
    rendition.themes.register("dark", {
      body: { background: "#19170f", color: "#f2ece3" },
    });

    function applyTheme() {
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

    rendition.display(initialLocation ?? undefined);

    rendition.on(
      "relocated",
      (location: { start: { cfi: string; percentage: number } }) => {
        currentCfiRef.current = location.start.cfi;
        saveProgress({
          location: location.start.cfi,
          percent: Math.round(location.start.percentage * 10000) / 100,
        });
      }
    );

    rendition.on("selected", (cfiRange: string, contents: { window: Window }) => {
      if (!highlightModeRef.current) return;

      const selectedText = contents.window.getSelection()?.toString().trim();
      if (!selectedText) return;

      rendition.annotations.highlight(cfiRange, {}, undefined, "shelf-highlight", {
        fill: "#b1502e",
        "fill-opacity": "0.35",
        "mix-blend-mode": "multiply",
      });
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

    book.ready.then(() => book.locations.generate(1600)).catch(() => {});

    fetch(`/api/books/${bookId}/annotations`)
      .then((res) => res.json())
      .then((data: { annotations?: { type: string; location: string }[] }) => {
        for (const annotation of data.annotations ?? []) {
          if (annotation.type === "highlight") {
            rendition.annotations.highlight(annotation.location, {}, undefined, "shelf-highlight", {
              fill: "#b1502e",
              "fill-opacity": "0.35",
              "mix-blend-mode": "multiply",
            });
          }
        }
      })
      .catch(() => {});

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", handleResize);
      rendition.destroy();
      book.destroy();
    };
  }, [bookId, initialLocation, saveProgress]);

  function changeFontSize(delta: number) {
    const next = Math.min(MAX_FONT_PERCENT, Math.max(MIN_FONT_PERCENT, fontPercent + delta));
    setFontPercent(next);
    renditionRef.current?.themes.fontSize(`${next}%`);
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
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

  return (
    <div className="flex h-full flex-col">
      <ReaderToolbar
        title={title}
        elapsedSeconds={elapsedSeconds}
        isFinished={isFinished}
        onMarkFinished={markFinished}
      >
        <Button variant="ghost" size="icon-sm" onClick={() => changeFontSize(-FONT_STEP)}>
          <Minus />
        </Button>
        <span className="text-sm text-muted-foreground tabular-nums">{fontPercent}%</span>
        <Button variant="ghost" size="icon-sm" onClick={() => changeFontSize(FONT_STEP)}>
          <Plus />
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
      <div className="relative flex-1 overflow-hidden">
        <button
          type="button"
          aria-label="Previous page"
          className="absolute inset-y-0 left-0 z-10 w-12 cursor-w-resize"
          onClick={() => renditionRef.current?.prev()}
        />
        <div ref={viewerRef} className="h-full" />
        <button
          type="button"
          aria-label="Next page"
          className="absolute inset-y-0 right-0 z-10 w-12 cursor-e-resize"
          onClick={() => renditionRef.current?.next()}
        />
      </div>
    </div>
  );
}
