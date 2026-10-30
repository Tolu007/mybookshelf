/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const { pathToFileURL } = require("node:url");

// Compile the actual TSX components in memory. No emitted files or test-only
// routes are added to the app, and no Supabase/Drive credentials are needed.
for (const extension of [".ts", ".tsx"]) {
  require.extensions[extension] = (module, filename) => {
    const source = fs.readFileSync(filename, "utf8").replaceAll("import.meta.url", JSON.stringify(pathToFileURL(filename).href));
    const compiled = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
      fileName: filename,
    });
    module._compile(compiled.outputText, filename);
  };
}
const resolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...args) {
  return resolveFilename.call(this, request.startsWith("@/") ? path.join(__dirname, "../src", request.slice(2)) : request, parent, ...args);
};

const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { AppRouterContext } = require("next/dist/shared/lib/app-router-context.shared-runtime");
const { PathnameContext, SearchParamsContext } = require("next/dist/shared/lib/hooks-client-context.shared-runtime");
const { ImageConfigContext } = require("next/dist/shared/lib/image-config-context.shared-runtime");
const { imageConfigDefault } = require("next/dist/shared/lib/image-config");
const imageConfig = { ...imageConfigDefault, ...require("../next.config.ts").default.images };
const { BookCard } = require("../src/components/book-card.tsx");
const { ReadingCard } = require("../src/components/library/reading-card.tsx");
const { LibraryShelves } = require("../src/components/library/library-shelves.tsx");
const { LibraryFilters } = require("../src/components/library/library-filters.tsx");
const { SidebarContent } = require("../src/components/shell/sidebar-content.tsx");
const { JournalList } = require("../src/components/journal/journal-list.tsx");
const { JournalComposer } = require("../src/components/journal/journal-composer.tsx");
const library = require("../src/lib/library.ts");
const journal = require("../src/lib/journal.ts");
const exportLib = require("../src/lib/export.ts");
const bytes = require("../src/lib/bytes.ts");
const { StorageBar, StorageUsage } = require("../src/components/settings/storage-usage.tsx");
const { DataSection } = require("../src/components/settings/data-section.tsx");
const { ReaderToolbar } = require("../src/components/readers/reader-toolbar.tsx");
const { ReadingBarChart, YearlyBarChart } = require("../src/components/stats/reading-bar-chart.tsx");
const { fetchAll } = require("../src/lib/supabase/fetch-all.ts");
const { FinishedBooksTable } = require("../src/components/stats/finished-books-table.tsx");
const { ReaderLoadStatus } = require("../src/components/readers/reader-load-status.tsx");
const { downloadBook, readerErrorMessage, readerErrorState } = require("../src/lib/book-download.ts");
const { classifyBookFileError, DriveAccessError } = require("../src/lib/book-file-errors.ts");
const LoginPage = require("../src/app/login/page.tsx").default;
const { ReaderScrubber } = require("../src/components/readers/reader-toolbar.tsx");
const { ReaderPage, paperStyle } = require("../src/components/readers/reader-page.tsx");
const { Typecraft } = require("../src/components/readers/typecraft.tsx");
const chapters = require("../src/lib/reader-chapters.ts");
const { SessionTimer } = require("../src/components/readers/session-timer.tsx");
const { ReaderNotesPanel, NotesPanelToggle } = require("../src/components/readers/reader-notes-panel.tsx");
const speed = require("../src/lib/reading-speed.ts");
const statsLib = require("../src/lib/stats.ts");
const { SettingsForm } = require("../src/components/settings/settings-form.tsx");
const preferences = require("../src/lib/preferences.ts");
const statsAggregate = require("../src/lib/stats-aggregate.ts");

const router = { back() {}, forward() {}, refresh() {}, push() {}, replace() {}, prefetch() {} };
function render(element, pathname = "/", query = "") {
  return renderToStaticMarkup(React.createElement(AppRouterContext.Provider, { value: router },
    React.createElement(PathnameContext.Provider, { value: pathname },
      React.createElement(SearchParamsContext.Provider, { value: new URLSearchParams(query) },
        React.createElement(ImageConfigContext.Provider, { value: imageConfig }, element)))));
}
const h = React.createElement;
const book = { id: "book-1", title: "A thoughtful book", author: "A Reader", cover_url: null, format: "epub", want_to_read: false, is_favorite: false, category_id: null };
const note = { id: "note-1", kind: "note", note: "An idea worth keeping.", excerpt: null, location: "epubcfi(/6/2[chapter]!/4/1:0)", createdAt: "2026-10-11T12:00:00Z", book: { id: book.id, title: book.title, format: "epub" } };
const onePage = { page: 1, pages: 1, total: 1, from: 1, to: 1 };
const fakeSession = (overrides) => ({ elapsedSeconds: 0, state: "running", reason: null, savedSeconds: 0, lastSessionSeconds: null, pause() {}, resume() {}, stop() {}, start() {}, ...overrides });
const shelfBook = (overrides) => ({ ...book, finished_at: null, added_at: "2026-01-01T00:00:00Z", percent: null, last_read_at: null, ...overrides });

test("book controls stay outside reading links and all links target the book", () => {
  const html = render(h(BookCard, { book }));
  const anchors = html.match(/<a\b[^>]*>[\s\S]*?<\/a>/g) ?? [];
  assert.equal(anchors.length, 2);
  for (const anchor of anchors) {
    assert.match(anchor, /href="\/read\/book-1"/);
    assert.doesNotMatch(anchor, /<button\b/);
  }
  assert.match(html, /aria-label="Book options"/);
  assert.match(html, /aria-label="Add to favorites"/);
  assert.match(html, /aria-pressed="false"/);
});

test("missing covers and authors have a usable fallback; user text is escaped", () => {
  const html = render(h(BookCard, { book: { ...book, title: '<script>alert("x")</script>', author: null } }));
  assert.match(html, /Unknown author/);
  assert.match(html, /Personal collection/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>/);
});

test("embedded and remote covers render without changing reading links", () => {
  for (const cover_url of ["data:image/png;base64,iVBORw0KGgo=", "https://covers.openlibrary.org/b/id/123-M.jpg"]) {
    const html = render(h(BookCard, { book: { ...book, cover_url } }));
    assert.match(html, /<img\b/);
    assert.match(html, /href="\/read\/book-1"/);
  }
});

test("reading card resumes the actual book and shows progress honestly", () => {
  const html = render(h(ReadingCard, { book, percent: 42.4, location: "epubcfi(/6/2)", categoryName: null, lastReadLabel: "2 hours ago", notes: 1, highlights: 3, primary: true }));
  assert.match(html, /42% through/);
  assert.match(html, /aria-valuenow="42"/);
  assert.match(html, /href="\/read\/book-1"/);
  assert.match(html, /Resume/);
  assert.match(html, /> 1 note</);
  assert.doesNotMatch(html, /epubcfi/);
  const pdf = render(h(ReadingCard, { book: { ...book, format: "pdf" }, percent: 10, location: "12", categoryName: "Essays", lastReadLabel: null, notes: 0, highlights: 0 }));
  assert.match(pdf, /Page 12/);
  assert.match(pdf, /Essays/);
  assert.match(pdf, /Continue/);
});

test("shelves have labeled view controls, keep input order, and keep filters in tab links", () => {
  const books = [shelfBook({}), shelfBook({ id: "book-2", title: "Another book" })];
  const html = render(h(LibraryShelves, { shelves: [{ id: "unshelved", name: "Unshelved", books }], tabs: [{ id: "unshelved", name: "Unshelved", count: 2 }], params: { q: "book" }, categories: [] }));
  assert.match(html, /2 books across 1 shelf/);
  assert.match(html, /aria-label="Grid view" aria-pressed="true"/);
  assert.match(html, /aria-label="List view" aria-pressed="false"/);
  assert.match(html, /href="\/\?q=book&amp;category=unshelved"/);
  assert.ok(html.indexOf("/read/book-1") < html.indexOf("/read/book-2"));
});

test("library filters label sorting and keep other filters in format links", () => {
  const html = render(h(LibraryFilters, { params: { shelf: "favorites", format: "pdf" }, formatCounts: { all: 3, epub: 2, pdf: 1 } }));
  assert.match(html, /aria-label="Sort books"/);
  assert.match(html, /aria-label="Show shelf"/);
  assert.match(html, /href="\/\?shelf=favorites&amp;format=epub"/);
  assert.match(html, /aria-current="page"[^>]*href="\/\?shelf=favorites&amp;format=pdf"/);
});

test("library helpers filter, sort, and group books into category shelves", () => {
  const books = [
    shelfBook({ id: "a", title: "Zeno", category_id: "c1", percent: 40, last_read_at: "2026-03-01" }),
    shelfBook({ id: "b", title: "Aurelius", author: "Marcus", category_id: null, finished_at: "2026-02-01" }),
    shelfBook({ id: "c", title: "Meditations", category_id: "missing", want_to_read: true, format: "pdf" }),
  ];
  assert.deepEqual(library.filterBooks(books, { shelf: "reading" }).map((b) => b.id), ["a"]);
  assert.deepEqual(library.filterBooks(books, { q: "marcus" }).map((b) => b.id), ["b"]);
  assert.deepEqual(library.filterBooks(books, { category: "unshelved" }).map((b) => b.id), ["b"]);
  assert.deepEqual(library.filterByFormat(books, "pdf").map((b) => b.id), ["c"]);
  assert.deepEqual(library.sortBooks(books, "title").map((b) => b.id), ["b", "c", "a"]);
  assert.equal(library.sortBooks(books, "read")[0].id, "a");
  const shelves = library.groupIntoShelves(books, [{ id: "c1", name: "Stoics" }]);
  assert.deepEqual(shelves.map((shelf) => [shelf.name, shelf.books.map((b) => b.id)]), [["Stoics", ["a"]], ["Unshelved", ["b", "c"]]]);
  assert.equal(library.bookStatus(books[0]), "reading");
  assert.equal(library.bookStatus(books[1]), "finished");
  assert.equal(library.bookStatus(books[2]), "want_to_read");
  assert.equal(library.libraryHref({ q: "x", sort: "title" }, { sort: "" }), "/?q=x");
});

test("sidebar links every section, marks the active one, and labels the collapsed rail", () => {
  const props = { categories: [], activeBookId: "book-1", streak: { current: 4, longest: 9 } };
  const html = render(h(SidebarContent, { ...props, collapsed: false, onToggleCollapsed() {} }), "/journal");
  for (const href of ["/", "/read/book-1", "/stats", "/journal", "/settings"]) assert.ok(html.includes('href="' + href + '"'), href);
  const journalLink = (html.match(/<a\b[^>]*>/g) ?? []).find((tag) => tag.includes('href="/journal"'));
  assert.match(journalLink, /aria-current="page"/);
  assert.match(html, />4-day streak</);
  assert.match(html, /aria-label="Collapse sidebar"/);
  const collapsed = render(h(SidebarContent, { ...props, activeBookId: null, collapsed: true, onToggleCollapsed() {} }), "/");
  assert.match(collapsed, /aria-label="Expand sidebar"/);
  assert.match(collapsed, /aria-label="Upload book"/);
  assert.match(collapsed, /class="sr-only">Statistics</);
  assert.match(collapsed, /aria-disabled="true"[^>]*title="Open a book to start reading"/);
});

test("journal handles empty entries, standalone reflections, highlights, and exact locations", () => {
  const counts = { all: 3, in_book: 1, standalone: 1, highlights: 1 };
  assert.match(render(h(JournalList, { entries: [], counts: { all: 0, in_book: 0, standalone: 0, highlights: 0 }, tab: "all", query: "", pagination: onePage })), /Good thoughts deserve a place/);
  const standalone = { ...note, id: "note-2", note: "A thought of my own.", book: null, location: null };
  const highlight = { ...note, id: "hl-1", kind: "highlight", note: null, excerpt: "A passage worth keeping." };
  const html = render(h(JournalList, { entries: [note, standalone, highlight], counts, tab: "all", query: "", pagination: onePage }));
  assert.match(html, /An idea worth keeping/);
  assert.match(html, /href="\/read\/book-1\?location=epubcfi/);
  assert.match(html, /aria-label="Delete note from A thoughtful book"/);
  assert.match(html, /aria-label="Delete highlight from A thoughtful book"/);
  assert.match(html, /Standalone reflection/);
  assert.match(html, /aria-label="Delete entry"/);
  assert.match(html, /A passage worth keeping/);
  assert.match(html, /All entries<span[^>]*>3</);
  assert.match(html, /aria-current="page"[^>]*href="\/journal"/);
});

test("journal search matches notes, passages and titles, marks matches, and keeps the tab", () => {
  const standalone = { ...note, id: "note-2", note: "Stoic calm (on mornings).", book: null };
  assert.equal(journal.matchesQuery(note, "IDEA"), true);
  assert.equal(journal.matchesQuery(note, "thoughtful"), true);
  assert.equal(journal.matchesQuery(standalone, "thoughtful"), false);
  assert.equal(journal.matchesQuery(standalone, "  "), true);
  assert.deepEqual(journal.splitOnMatches("Calm, then calm again", "calm"), ["", "Calm", ", then ", "calm", " again"]);
  assert.deepEqual(journal.splitOnMatches("(on mornings)", "(on"), ["", "(on", " mornings)"]);
  assert.equal(journal.parseTab("highlights"), "highlights");
  assert.equal(journal.parseTab("nonsense"), "all");
  assert.deepEqual(journal.tabCounts([note, standalone]), { all: 2, in_book: 1, standalone: 1, highlights: 0 });
  assert.equal(journal.journalHref({ q: " stoic ", tab: "standalone" }), "/journal?q=stoic&tab=standalone");
  assert.equal(journal.journalHref({ tab: "all" }), "/journal");
  const html = render(h(JournalList, { entries: [standalone], counts: { all: 1, in_book: 0, standalone: 1, highlights: 0 }, tab: "standalone", query: "calm", pagination: onePage }));
  assert.match(html, /<mark[^>]*>calm<\/mark>/);
  assert.match(html, /1 entry matches/);
  assert.match(html, /name="tab" value="standalone"/);
  assert.match(html, /href="\/journal\?tab=standalone"[^>]*>.*Clear search/s);
  assert.match(html, /href="\/journal\?q=calm&amp;tab=highlights"/);
  assert.match(render(h(JournalList, { entries: [], counts: { all: 0, in_book: 0, standalone: 0, highlights: 0 }, tab: "all", query: "zzz", pagination: onePage })), /Nothing matches that search/);
});

test("journal composer writes standalone entries and links books only when there are some", () => {
  const html = render(h(JournalComposer, { books: [] }));
  assert.match(html, /Writing desk/);
  assert.match(html, /aria-checked="true"[^>]*>.*Standalone reflection/s);
  assert.match(html, /disabled=""[^>]*title="Add a book to link entries to it"/);
  const withBooks = render(h(JournalComposer, { books: [{ id: book.id, title: book.title, location: "1" }] }));
  assert.doesNotMatch(withBooks, /Add a book to link entries to it/);
});

test("reader toolbar retains back navigation, reading controls, and finished state", () => {
  const html = render(h(ReaderToolbar, { title: book.title, session: fakeSession({ elapsedSeconds: 120 }), isFinished: true, onMarkFinished() {} }, h("button", { "aria-label": "Next page" }, "Next")));
  assert.match(html, /aria-label="Back to your library"/);
  assert.match(html, /aria-label="Reading controls"/);
  assert.match(html, /2m this session/);
  assert.match(html, /disabled=""/);
  assert.match(html, /Finished/);
});

test("session timer offers pause and stop while reading, resume when paused, and a new session once stopped", () => {
  const running = render(h(SessionTimer, { session: fakeSession({ elapsedSeconds: 65 }) }));
  assert.match(running, /In focus/);
  assert.match(running, /00:01:05/);
  assert.match(running, /aria-label="Pause session"/);
  assert.match(running, /aria-label="Stop and save session"/);
  const paused = render(h(SessionTimer, { session: fakeSession({ state: "paused", reason: "manual" }) }));
  assert.match(paused, /Paused/);
  assert.match(paused, /aria-label="Resume session"/);
  assert.doesNotMatch(paused, /Pause session/);
  const stopped = render(h(SessionTimer, { session: fakeSession({ state: "stopped", lastSessionSeconds: 754 }) }));
  assert.match(stopped, /Session saved · 13m/);
  assert.match(stopped, /New session/);
  assert.match(render(h(SessionTimer, { session: fakeSession({ state: "stopped", lastSessionSeconds: 0 }) })), /too short to save/);
  assert.match(render(h(SessionTimer, { session: fakeSession({ state: "paused", reason: "idle" }) })), /Paused · idle/);
  assert.equal(preferences.parsePreferences({ timer: { autoPauseMinutes: 5 } }).timer.autoPauseMinutes, 5);
  assert.equal(preferences.parsePreferences({ timer: { autoPauseMinutes: 7 } }).timer.autoPauseMinutes, null);
  assert.match(render(h(SettingsForm, { initial: preferences.DEFAULT_PREFERENCES, profile: null })), /aria-label="Automatic pause"/);
  assert.equal(preferences.parsePreferences({ timer: { chimeMinutes: 30 } }).timer.chimeMinutes, 30);
  assert.equal(preferences.parsePreferences({ timer: { chimeMinutes: 20 } }).timer.chimeMinutes, null);
  assert.match(render(h(SettingsForm, { initial: preferences.DEFAULT_PREFERENCES, profile: null })), /aria-label="Interval chime"/);
  assert.match(render(h(SessionTimer, { session: fakeSession({ elapsedSeconds: 60 }), pomodoro: { phase: "focus", secondsLeft: 1102, cycles: 0 } })), /Focus 18:22/);
  const onBreak = render(h(SessionTimer, { session: fakeSession({ state: "paused", reason: "break" }), pomodoro: { phase: "break", secondsLeft: 250, cycles: 1 } }));
  assert.match(onBreak, /On a break/);
  assert.match(onBreak, /Break 4:10/);
  assert.match(onBreak, /aria-label="End break and resume"/);
  assert.match(render(h(SessionTimer, { session: fakeSession({ state: "paused", reason: "break" }), pomodoro: { phase: "break_over", secondsLeft: 0, cycles: 1 } })), /Break over/);
  const pomodoroPrefs = preferences.parsePreferences({ timer: { pomodoro: true, focusMinutes: 45, breakMinutes: 7 } }).timer;
  assert.deepEqual([pomodoroPrefs.pomodoro, pomodoroPrefs.focusMinutes, pomodoroPrefs.breakMinutes], [true, 45, 5]);
  const withPomodoro = render(h(SettingsForm, { initial: { ...preferences.DEFAULT_PREFERENCES, timer: { ...preferences.DEFAULT_PREFERENCES.timer, pomodoro: true } }, profile: null }));
  assert.match(withPomodoro, /aria-label="Focus length"/);
  assert.doesNotMatch(render(h(SettingsForm, { initial: preferences.DEFAULT_PREFERENCES, profile: null })), /Focus length/);
});

test("reading speed counts words, ignores flips and long stays, and formats time left", () => {
  assert.equal(speed.countWords("It was the best of times, it was the worst — of times."), 12);
  assert.equal(speed.countWords("l’homme d'affaires well-known 2026"), 4);
  assert.equal(speed.isPlausiblePage(300, 75), true);
  assert.equal(speed.isPlausiblePage(300, 2), false);
  assert.equal(speed.isPlausiblePage(300, 16 * 60), false);
  assert.equal(speed.isPlausiblePage(300, 10), false);
  assert.equal(speed.wordsPerMinute(600, 150), 240);
  assert.equal(speed.wordsPerMinute(0, 150), null);
  assert.equal(speed.formatTimeLeft(0.4), "under a minute");
  assert.equal(speed.formatTimeLeft(12.4), "12 min");
  assert.equal(speed.formatTimeLeft(125), "2h 5m");
  const scrubber = render(h(ReaderScrubber, { percent: 40, timeLeft: "~12 min left in chapter 4", speed: "240 wpm", chapter: "4 of 12", position: "Page 4 of 10" }));
  assert.match(scrubber, /~12 min left in chapter 4/);
  assert.match(scrubber, /Reading cadence: 240 wpm/);
  assert.match(scrubber, /Chapter: <strong[^>]*>4 of 12/);
});

test("sessions are still recorded when the speed columns don't exist yet", async () => {
  const inserts = [];
  const supabase = {
    from(table) {
      const query = {
        insert: async (row) => {
          inserts.push(row);
          return { error: table === "reading_sessions" && "words_read" in row ? { code: "PGRST204" } : null };
        },
        select: () => query,
        eq: () => query,
        single: async () => ({ data: { current_streak: 0, longest_streak: 0, last_read_date: "2026-10-30" }, error: null }),
        update: () => query,
      };
      return query;
    },
  };
  await statsLib.recordReadingSession(supabase, "user-1", {
    bookId: "book-1", startedAt: "a", endedAt: "b", durationSeconds: 600, localDate: "2026-10-30", speed: { wordsRead: 2400, wordSeconds: 540 },
  });
  assert.equal(inserts.length, 2);
  assert.equal(inserts[0].words_read, 2400);
  assert.equal("words_read" in inserts[1], false);
  assert.equal(inserts[1].duration_seconds, 600);
});

test("notes panel writes notes pinned to the current page, logs passages, and closes to nothing", () => {
  const annotations = [
    { id: "a1", type: "highlight", location: "118", excerpt: "A passage.", note: null, created_at: "2026-10-30T10:00:00Z" },
    { id: "a2", type: "note", location: "120", excerpt: null, note: "A thought.", created_at: "2026-10-30T11:00:00Z" },
  ];
  const props = { id: "notes", bookId: book.id, bookTitle: "The Overstory", onClose() {}, annotations, loading: false, onDelete() {}, getCurrentLocation: () => "12", describeLocation: (location) => `Page ${location}`, onJumpTo() {}, onSaved() {} };
  const open = render(h(ReaderNotesPanel, { ...props, open: true }));
  assert.match(open, /aria-label="Session journal"/);
  assert.match(open, /The Overstory • 1 note, 1 highlight/);
  assert.match(open, /Write marginalia/);
  assert.match(open, /Page 12 citation/);
  assert.match(open, /Page 118/);
  assert.match(open, /A passage\./);
  assert.match(open, /aria-label="Delete highlight"/);
  assert.match(open, /aria-label="Close notes panel"/);
  assert.match(open, /disabled=""[^>]*>.*Save to journal/s);
  assert.equal(render(h(ReaderNotesPanel, { ...props, open: false })), "");
  const toggle = render(h(NotesPanelToggle, { open: false, onToggle() {}, panelId: "notes", count: 14 }));
  assert.match(toggle, /aria-expanded="false"/);
  assert.match(toggle, /aria-controls="notes"/);
  assert.match(toggle, />14</);
});

test("reader chapters come from where each one starts, and know which one you're in", () => {
  const list = chapters.tidyChapters([
    { label: " Roots ", start: 3 },
    { label: "Trunk", start: 9 },
    { label: "Duplicate", start: 3 },
    { label: "", start: 12 },
    { label: "Prologue", start: 1 },
  ]);
  assert.deepEqual(list.map((chapter) => [chapter.label, chapter.start]), [["Prologue", 1], ["Roots", 3], ["Trunk", 9]]);
  assert.equal(chapters.chapterAt(list, 0), null);
  const place = chapters.chapterAt(list, 5);
  assert.deepEqual([place.number, place.count, place.chapter.label, place.next.label], [2, 3, "Roots", "Trunk"]);
  assert.equal(chapters.chapterAt(list, 40).next, null);
  const cfis = ["epubcfi(/6/2!/4/2)", "epubcfi(/6/2!/4/8)", "epubcfi(/6/4!/4/2)", "epubcfi(/6/6!/4/2)"];
  assert.deepEqual(chapters.chapterPositions(cfis, ["/6/4", "/6/6", "/6/40"]), [0.5, 0.75, null]);
});

test("reader page turns from its footer, and paper can be textured", () => {
  const html = render(h(ReaderPage, { eyebrow: "Part I • Roots", caption: "Richard Powers", pageLabel: "142", onPrev() {}, onNext() {}, canPrev: false }, h("div", null, "Text")));
  assert.match(html, /Part I • Roots/);
  assert.match(html, /Richard Powers/);
  assert.match(html, />142</);
  assert.match(html, /aria-label="Previous page" disabled=""|disabled=""[^>]*aria-label="Previous page"/);
  assert.match(html, /aria-label="Next page"/);
  assert.equal(paperStyle("#faf7f2", "#111", true).backgroundSize, "18px 18px");
  assert.equal(paperStyle("#1a201c", "#eee", false).backgroundImage, undefined);
});

test("typecraft opens from a labelled trigger in the reader bar", () => {
  const html = render(h(Typecraft, { typography: preferences.DEFAULT_PREFERENCES.reader, onChange() {}, onSaveDefault: async () => true }));
  assert.match(html, /Typecraft/);
  assert.match(html, /aria-haspopup="dialog"|aria-expanded="false"/);
});

test("reader toolbar shows today's goal including the current and stopped sessions, where you are, and a book position line", () => {
  const html = render(h(ReaderToolbar, { title: book.title, format: "pdf", chapterLabel: "Chapter 4: Roots", progressLabel: "28% (p. 142/502)", session: fakeSession({ elapsedSeconds: 600, savedSeconds: 300 }), isFinished: false, onMarkFinished() {}, dailyGoalMinutes: 40, minutesBeforeSession: 5, trailing: h("button", null, "Journal") }));
  assert.match(html, /00:10:00/);
  assert.match(html, /20 \/ 40m/);
  assert.match(html, /Chapter 4: Roots/);
  assert.match(html, /28% \(p\. 142\/502\)/);
  assert.ok(html.indexOf("Finish book") < html.indexOf(">Journal<"));
  assert.match(html, /aria-label="Today&#x27;s reading goal"[^>]*aria-valuenow="50"/);
  assert.match(html, /Finish book/);
  assert.doesNotMatch(render(h(ReaderToolbar, { title: book.title, session: fakeSession(), isFinished: false, onMarkFinished() {} })), /reading goal/);
  const line = render(h(ReaderScrubber, { percent: 140, position: "Page 3 of 3", markers: [{ label: "Ch. 2", percent: 50 }] }));
  assert.match(line, /role="slider"[^>]*aria-valuenow="100"/);
  assert.match(line, /Page 3 of 3/);
  assert.match(line, /title="Ch. 2"[^>]*left:50%/);
  assert.match(line, /tabindex="-1"/);
  assert.match(render(h(ReaderScrubber, { percent: 10, position: "x", onSeek() {} })), /tabindex="0"/);
  assert.match(line, /aria-label="Hide reading progress" aria-expanded="true"|aria-expanded="true"[^>]*aria-label="Hide reading progress"/);
});

test("preferences fall back to defaults for missing or invalid values and keep valid ones", () => {
  assert.deepEqual(preferences.parsePreferences(null), preferences.DEFAULT_PREFERENCES);
  const parsed = preferences.parsePreferences({
    reader: { font: "garamond", fontSize: 99, lineHeight: 1.9, measure: 13, paper: "sepia", justify: "yes" },
    goals: { dailyMinutes: 45, yearlyBooks: -2 },
  });
  assert.equal(parsed.reader.font, "garamond");
  assert.equal(parsed.reader.fontSize, 18);
  assert.equal(parsed.reader.lineHeight, 1.9);
  assert.equal(parsed.reader.measure, 72);
  assert.equal(parsed.reader.paper, "sepia");
  assert.equal(parsed.reader.justify, false);
  assert.deepEqual(parsed.goals, { dailyMinutes: 45, yearlyBooks: null });
  assert.match(preferences.readerFontStylesheet("literata"), /^https:\/\/fonts\.googleapis\.com\/css2\?family=Literata/);
});

test("settings form offers real options only and saves only when something changed", () => {
  const html = render(h(SettingsForm, { initial: preferences.DEFAULT_PREFERENCES, profile: h("p", null, "Profile card") }), "/settings");
  assert.match(html, /role="radiogroup" aria-label="Typeface"/);
  assert.match(html, /aria-label="Page colour"/);
  assert.match(html, /Daily reading target/);
  assert.match(html, /Profile card/);
  assert.match(html, /disabled=""[^>]*>.*Save changes/s);
  assert.doesNotMatch(html, /Readwise|Obsidian Markdown|LaTeX/);
});

test("stats helpers find the peak weekday and count active days in range", () => {
  const days = new Map([["2026-03-01", 30], ["2026-03-08", 90], ["2026-03-02", 20], ["2026-04-01", 0]]);
  assert.deepEqual(statsAggregate.peakWeekday(days), { label: "Sundays", averageMinutes: 60 });
  assert.equal(statsAggregate.peakWeekday(new Map()), null);
  assert.equal(statsAggregate.countActiveDays(days, "2026-03-02", "2026-04-30"), 2);
});

test("year views find streaks within the period and total reading per year", () => {
  const days = new Map([["2025-12-30", 10], ["2025-12-31", 10], ["2026-01-01", 10], ["2026-01-03", 5], ["2026-01-04", 0]]);
  assert.equal(statsAggregate.longestStreakIn(days), 3);
  assert.equal(statsAggregate.longestStreakIn(new Map()), 0);
  assert.deepEqual(statsAggregate.buildYearlyTotals(new Map([["2023-05-01", 90], ["2025-02-01", 30]]), 2026), [
    { year: 2023, minutes: 90 }, { year: 2024, minutes: 0 }, { year: 2025, minutes: 30 }, { year: 2026, minutes: 0 },
  ]);
  assert.deepEqual(statsAggregate.buildYearlyTotals(new Map(), 2026), [{ year: 2026, minutes: 0 }]);
  const chart = render(h(YearlyBarChart, { dailyMinutes: new Map([["2025-01-01", 120], ["2026-01-01", 60]]), untilYear: 2026 }));
  assert.match(chart, /title="2025: 2h 0m"[^>]*bg-ribbon/);
  assert.match(chart, /title="2026: 1h 0m"/);
});

test("finished-books table lists books with date, time and sessions, or an empty note", () => {
  const html = render(h(FinishedBooksTable, { periodName: "2026", books: [
    { id: "book-1", title: "Middlemarch", author: "George Eliot", cover_url: null, finished_at: "2026-10-18T12:00:00Z", shelf: "Fiction", minutes: 1185, sessions: 14 },
  ] }));
  assert.match(html, /1 in 2026/);
  assert.match(html, /Middlemarch/);
  assert.match(html, /href="\/read\/book-1"/);
  assert.match(html, /Oct 18, 2026/);
  assert.match(html, /19h 45m/);
  assert.match(html, />14</);
  assert.match(html, /Fiction/);
  assert.match(render(h(FinishedBooksTable, { periodName: "2024", books: [] })), /No books finished in 2024 yet/);
});

test("journal pages clamp to what exists and keep search and tab in page links", () => {
  const items = Array.from({ length: 45 }, (_, index) => index);
  assert.deepEqual(journal.paginate(items, "2").pagination, { page: 2, pages: 3, total: 45, from: 21, to: 40 });
  assert.equal(journal.paginate(items, "2").items[0], 20);
  assert.equal(journal.paginate(items, "99").pagination.page, 3);
  assert.equal(journal.paginate(items, "abc").pagination.page, 1);
  assert.deepEqual(journal.paginate([], undefined).pagination, { page: 1, pages: 1, total: 0, from: 0, to: 0 });
  assert.equal(journal.journalHref({ q: "calm", tab: "highlights", page: 3 }), "/journal?q=calm&tab=highlights&page=3");
  assert.equal(journal.journalHref({ page: 1 }), "/journal");
  const html = render(h(JournalList, { entries: [note], counts: { all: 45, in_book: 45, standalone: 0, highlights: 0 }, tab: "in_book", query: "idea", pagination: { page: 2, pages: 3, total: 45, from: 21, to: 40 } }));
  assert.match(html, /Showing 21–40 of 45 entries/);
  const pageLink = (rel) => (html.match(/<a\b[^>]*>/g) ?? []).find((tag) => tag.includes(`rel="${rel}"`));
  assert.match(pageLink("prev"), /href="\/journal\?q=idea&amp;tab=in_book"/);
  assert.match(pageLink("next"), /href="\/journal\?q=idea&amp;tab=in_book&amp;page=3"/);
  assert.match(html, /Page 2 of 3/);
  assert.doesNotMatch(render(h(JournalList, { entries: [note], counts: { all: 1, in_book: 1, standalone: 0, highlights: 0 }, tab: "all", query: "", pagination: onePage })), /Journal pages/);
});

test("library export reads as a journal and per-book notes, and links both formats", () => {
  const data = {
    exported_at: "2026-10-30T09:00:00Z",
    note: "",
    books: [
      { id: "b1", title: "Meditations", author: "Marcus Aurelius", format: "epub", category: "Stoics", added_at: "2026-01-01T00:00:00Z", finished_at: "2026-03-02T00:00:00Z", want_to_read: false, is_favorite: true, progress_percent: 100 },
      { id: "b2", title: "Unopened", author: null, format: "pdf", category: null, added_at: "2026-01-01T00:00:00Z", finished_at: null, want_to_read: true, is_favorite: false, progress_percent: null },
    ],
    annotations: [
      { id: "a1", type: "highlight", book_id: "b1", location: "x", excerpt: "You have power over your mind.", note: null, created_at: "2026-02-01T10:00:00Z" },
      { id: "a2", type: "note", book_id: "b1", location: "x", excerpt: null, note: "Read this\nagain.", created_at: "2026-02-02T10:00:00Z" },
      { id: "a3", type: "note", book_id: null, location: null, excerpt: null, note: "Ask and you shall receive.", created_at: "2026-02-03T10:00:00Z" },
      { id: "a4", type: "bookmark", book_id: "b1", location: "y", excerpt: null, note: null, created_at: "2026-02-04T10:00:00Z" },
    ],
    reading_sessions: [{ book_id: "b1", started_at: "s", ended_at: "e", duration_seconds: 5400, local_date: "2026-02-01" }],
    stats: null,
    preferences: null,
  };
  const md = exportLib.buildExportMarkdown(data);
  assert.match(md, /^# Shelf export/);
  assert.match(md, /## Journal\n\n### Feb 3, 2026\n\nAsk and you shall receive\./);
  assert.match(md, /### Meditations\n\nMarcus Aurelius · Stoics · EPUB · Finished Mar 2, 2026 · 1h 30m reading · Favorite/);
  assert.match(md, /#### Highlights\n\n> You have power over your mind\./);
  assert.match(md, /- Feb 2, 2026: Read this again\./);
  assert.match(md, /### Unopened\n\nPDF · Want to read/);
  assert.doesNotMatch(md, /\n{3,}/);
  assert.equal(exportLib.exportFileName("json", new Date(2026, 9, 30)), "shelf-export-2026-10-30.json");
  const section = render(h(DataSection));
  assert.match(section, /href="\/api\/export\?format=markdown" download=""/);
  assert.match(section, /href="\/api\/export\?format=json" download=""/);
});

test("storage shows Shelf's share against the whole Drive, unlimited plans, and Shelf alone", () => {
  assert.equal(bytes.formatBytes(500), "1 KB");
  assert.equal(bytes.formatBytes(2.5 * 1024 * 1024), "2.5 MB");
  assert.equal(bytes.formatBytes(1.42 * 1024 ** 3), "1.42 GB");
  assert.equal(bytes.formatBytes(15 * 1024 ** 3), "15 GB");
  assert.equal(bytes.formatBytes(150 * 1024 ** 3), "150 GB");
  const gb = 1024 ** 3;
  const full = render(h(StorageBar, { report: { shelfBytes: 1.5 * gb, bookCount: 12, drive: { usage: 6 * gb, limit: 15 * gb } } }));
  assert.match(full, /1.5 GB/);
  assert.match(full, /across 12 books/);
  assert.match(full, /of 15 GB in your Drive \(6 GB used in total\)/);
  assert.match(full, /width:10%/);
  assert.match(full, /width:30%/);
  assert.match(full, /Free: 9 GB/);
  assert.match(render(h(StorageBar, { report: { shelfBytes: gb, bookCount: 1, drive: { usage: 2 * gb, limit: null } } })), /no storage limit/);
  assert.match(render(h(StorageBar, { report: { shelfBytes: gb, bookCount: 1, drive: null } })), /Shelf&#x27;s share only/);
  assert.match(render(h(StorageUsage)), /Checking storage/);
});

test("long result sets are fetched page by page until a short page", async () => {
  const pages = [];
  const rows = Array.from({ length: 5 }, (_, index) => index);
  const result = await fetchAll(async (from, to) => {
    pages.push([from, to]);
    return { data: rows.slice(from, to + 1), error: null };
  }, 2);
  assert.deepEqual(result.data, rows);
  assert.deepEqual(pages, [[0, 1], [2, 3], [4, 5]]);
  const failed = await fetchAll(async () => ({ data: null, error: { message: "boom" } }));
  assert.deepEqual(failed.data, []);
  assert.ok(failed.error);
});

test("zero reading data does not draw positive bars", () => {
  const html = render(h(ReadingBarChart, { dailyMinutes: new Map(), year: 2026 }));
  assert.equal((html.match(/height:0%/g) ?? []).length, 12);
  assert.match(html, />Hours</);
  assert.doesNotMatch(html, /NaN|Infinity/);
});

test("monthly chart converts minutes to hours and scales bars against the labeled axis", () => {
  const html = render(h(ReadingBarChart, {
    dailyMinutes: new Map([["2026-01-01", 120], ["2026-02-01", 240]]),
    year: 2026,
  }));
  for (const hours of [0, 1, 2, 3, 4]) {
    assert.match(html, new RegExp(`>${hours}</span>`));
  }
  assert.match(html, /title="Jan: 2h 0m"[^>]*height:50%/);
  assert.match(html, /title="Feb: 4h 0m"[^>]*height:100%/);
  const large = render(h(ReadingBarChart, { dailyMinutes: new Map([["2026-01-01", 7500]]), year: 2026 }));
  assert.match(large, />200<\/span>/);
  assert.match(large, /title="Jan: 125h 0m"[^>]*height:62.5%/);
});

test("sign-in screen renders without credentials and retains its Google action", () => {
  const html = render(h(LoginPage), "/login");
  assert.match(html, /Continue with Google/);
  assert.match(html, /Enter your library/);
  assert.match(html, /Books stay in your Drive/);
  assert.doesNotMatch(html, /SQLite|Telemetry|passkey/i);
});

test("reader shows download percentage, unknown size, preparation, and useful errors", () => {
  const progress = render(h(ReaderLoadStatus, { state: { phase: "downloading", loaded: 512, total: 1024 }, onRetry() {} }));
  assert.match(progress, /role="progressbar"/);
  assert.match(progress, /aria-valuenow="50"/);
  assert.match(progress, /50%/);
  const unknown = render(h(ReaderLoadStatus, { state: { phase: "downloading", loaded: 1024, total: null }, onRetry() {} }));
  assert.doesNotMatch(unknown, /aria-valuenow/);
  assert.match(unknown, /1 KB received/);
  assert.match(render(h(ReaderLoadStatus, { state: { phase: "opening" }, onRetry() {} })), /100% downloaded/);
  assert.equal(render(h(ReaderLoadStatus, { state: { phase: "ready" }, onRetry() {} })), "");
  const error = render(h(ReaderLoadStatus, { state: { phase: "error", message: "Check your connection and try again." }, onRetry() {} }));
  assert.match(error, /role="alert"/);
  assert.match(error, /Try again/);
  assert.match(error, /Back to library/);
  assert.match(error, /Check your connection/);
  const reconnect = render(h(ReaderLoadStatus, { state: { phase: "error", message: "Renew your connection.", reconnect: true }, onRetry() {} }));
  assert.match(reconnect, /Reconnect Google Drive/);
  assert.doesNotMatch(error, /Reconnect Google Drive/);
});

test("expired Google grants and server configuration failures are distinguished from outages", () => {
  assert.equal(classifyBookFileError({ response: { status: 400, data: { error: "invalid_grant" } } }).code, "drive_reconnect");
  assert.equal(classifyBookFileError(new Error("invalid_grant: Token has been expired or revoked.")).status, 403);
  assert.equal(classifyBookFileError({ response: { status: 400, data: { error: "invalid_client" } } }).code, "drive_configuration");
  assert.equal(classifyBookFileError(new DriveAccessError("drive_configuration")).status, 500);
  assert.equal(classifyBookFileError(new DriveAccessError("token_store_unavailable")).reconnect, false);
  assert.equal(classifyBookFileError({ response: { status: 403, data: { error: { errors: [{ reason: "userRateLimitExceeded" }] } } } }).status, 429);
  assert.equal(classifyBookFileError({ response: { status: 404 } }).status, 404);
  const failure = classifyBookFileError({ code: "ECONNRESET", message: "secret token", config: { headers: { Authorization: "Bearer secret" } } });
  assert.equal(failure.status, 503);
  assert.equal(failure.transportCode, "ECONNRESET");
  assert.doesNotMatch(JSON.stringify(failure), /secret|Authorization/);
});

test("file route logs safe diagnostics and returns a reconnect error for an expired Google grant", async () => {
  const loadModule = Module._load;
  const logError = console.error;
  let upstreamError = { response: { status: 400, data: { error: "invalid_grant" } }, config: { client_secret: "private-secret" } };
  const logs = [];
  try {
    Module._load = function (request, ...args) {
      if (request === "@/lib/supabase/server") return { createClient: async () => ({
        auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) },
        from: () => {
          const query = { select: () => query, eq: () => query, single: async () => ({ data: { drive_file_id: "drive-1", format: "pdf", file_size_bytes: 3 } }) };
          return query;
        },
      }) };
      if (request === "@/lib/google/drive") return { getBookFileStream: async () => {
        if (upstreamError) throw upstreamError;
        return require("node:stream").Readable.from([Buffer.from([1, 2, 3])]);
      } };
      return loadModule.call(this, request, ...args);
    };
    console.error = (...args) => logs.push(args);
    const { GET } = require("../src/app/api/books/[id]/file/route.ts");
    const request = new Request("https://shelf.example/api/books/book-1/file");
    const context = { params: Promise.resolve({ id: "book-1" }) };
    const expired = await GET(request, context);
    assert.equal(expired.status, 403);
    assert.equal(expired.headers.get("X-Book-Error"), "drive_reconnect");
    assert.match((await expired.json()).error, /renewed/);
    assert.equal(logs[0][1].upstreamStatus, 400);
    assert.doesNotMatch(JSON.stringify(logs), /private-secret|client_secret/);
    upstreamError = { code: "ETIMEDOUT" };
    const outage = await GET(request, context);
    assert.equal(outage.status, 503);
    assert.equal(logs.at(-1)[1].transportCode, "ETIMEDOUT");
    upstreamError = null;
    const success = await GET(request, context);
    assert.equal(success.status, 200);
    assert.equal(success.headers.get("X-Book-Size"), "3");
    assert.deepEqual([...new Uint8Array(await success.arrayBuffer())], [1, 2, 3]);
  } finally {
    Module._load = loadModule;
    console.error = logError;
  }
});

test("book downloads report real chunk progress and return the exact file bytes", async () => {
  const originalFetch = global.fetch;
  try {
    global.fetch = async () => new Response(new ReadableStream({ start(controller) {
      controller.enqueue(new Uint8Array([1, 2]));
      controller.enqueue(new Uint8Array([3, 4]));
      controller.close();
    } }), { headers: { "X-Book-Size": "4" } });
    const progress = [];
    const bytes = await downloadBook("book-1", new AbortController().signal, (state) => progress.push(state));
    assert.deepEqual([...new Uint8Array(bytes)], [1, 2, 3, 4]);
    assert.deepEqual(progress.filter((state) => state.loaded > 0).map((state) => [state.loaded, state.total]), [[2, 4], [4, 4]]);
    assert.equal(progress.at(-1).phase, "opening");
    global.fetch = async () => new Response(new Uint8Array([9]));
    const unknown = [];
    await downloadBook("book-1", new AbortController().signal, (state) => unknown.push(state));
    assert.equal(unknown.find((state) => state.loaded === 1).total, null);
  } finally { global.fetch = originalFetch; }
});

test("download failures are friendly, including interrupted streams and stalled connections", async () => {
  const originalFetch = global.fetch;
  try {
    for (const [status, message] of [[401, /sign-in has expired/], [403, /reconnect Drive/], [404, /no longer available/], [429, /wait a moment/], [500, /temporarily unavailable/]]) {
      global.fetch = async () => new Response("private upstream details", { status });
      await assert.rejects(downloadBook("book-1", new AbortController().signal, () => {}), message);
    }
    global.fetch = async () => new Response("private details", { status: 403, headers: { "X-Book-Error": "drive_reconnect" } });
    await assert.rejects(downloadBook("book-1", new AbortController().signal, () => {}), (error) => {
      assert.equal(readerErrorState(error).reconnect, true);
      assert.match(readerErrorMessage(error), /renewed/);
      return true;
    });
    global.fetch = async () => new Response("private details", { status: 500, headers: { "X-Book-Error": "drive_configuration" } });
    await assert.rejects(downloadBook("book-1", new AbortController().signal, () => {}), /configured correctly/);
    global.fetch = async () => { throw new TypeError("Failed to fetch"); };
    await assert.rejects(downloadBook("book-1", new AbortController().signal, () => {}), /internet connection/);
    global.fetch = async () => {
      const response = new Response("Sign in");
      Object.defineProperties(response, { redirected: { value: true }, url: { value: "https://shelf.example/login" } });
      return response;
    };
    await assert.rejects(downloadBook("book-1", new AbortController().signal, () => {}), /sign-in has expired/);
    global.fetch = async () => new Response(new ReadableStream({ start(controller) {
      controller.error(new TypeError("connection reset"));
    } }));
    await assert.rejects(downloadBook("book-1", new AbortController().signal, () => {}), /internet connection/);
    global.fetch = async () => new Response(new Uint8Array([1]), { headers: { "X-Book-Size": "2" } });
    await assert.rejects(downloadBook("book-1", new AbortController().signal, () => {}), /interrupted/);
    global.fetch = async () => new Response(new Uint8Array());
    await assert.rejects(downloadBook("book-1", new AbortController().signal, () => {}), /empty/);
    global.fetch = async (_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(signal.reason), { once: true });
    });
    await assert.rejects(downloadBook("book-1", new AbortController().signal, () => {}, 10), /stopped responding/);
    const controller = new AbortController();
    const cancelled = downloadBook("book-1", controller.signal, () => {});
    controller.abort();
    await assert.rejects(cancelled, { name: "AbortError" });
    assert.match(readerErrorMessage(new Error("secret parser details")), /damaged or unsupported/);
  } finally { global.fetch = originalFetch; }
});
