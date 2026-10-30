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
const { ReaderToolbar } = require("../src/components/readers/reader-toolbar.tsx");
const { ReadingBarChart } = require("../src/components/stats/reading-bar-chart.tsx");
const { ReaderLoadStatus } = require("../src/components/readers/reader-load-status.tsx");
const { downloadBook, readerErrorMessage, readerErrorState } = require("../src/lib/book-download.ts");
const { classifyBookFileError, DriveAccessError } = require("../src/lib/book-file-errors.ts");
const LoginPage = require("../src/app/login/page.tsx").default;
const { ReaderProgress } = require("../src/components/readers/reader-toolbar.tsx");
const { SessionTimer } = require("../src/components/readers/session-timer.tsx");
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
  assert.match(render(h(JournalList, { initialEntries: [] })), /Good thoughts deserve a place/);
  const standalone = { ...note, id: "note-2", note: "A thought of my own.", book: null, location: null };
  const highlight = { ...note, id: "hl-1", kind: "highlight", note: null, excerpt: "A passage worth keeping." };
  const html = render(h(JournalList, { initialEntries: [note, standalone, highlight] }));
  assert.match(html, /An idea worth keeping/);
  assert.match(html, /href="\/read\/book-1\?location=epubcfi/);
  assert.match(html, /aria-label="Delete note from A thoughtful book"/);
  assert.match(html, /aria-label="Delete highlight from A thoughtful book"/);
  assert.match(html, /Standalone reflection/);
  assert.match(html, /aria-label="Delete entry"/);
  assert.match(html, /A passage worth keeping/);
  assert.match(html, /All entries<span[^>]*>3</);
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
});

test("reader toolbar shows today's goal including the current and stopped sessions, and a book progress ribbon", () => {
  const html = render(h(ReaderToolbar, { title: book.title, format: "pdf", session: fakeSession({ elapsedSeconds: 600, savedSeconds: 300 }), isFinished: false, onMarkFinished() {}, dailyGoalMinutes: 40, minutesBeforeSession: 5 }));
  assert.match(html, /00:10:00/);
  assert.match(html, /20\/40m/);
  assert.match(html, /aria-label="Today&#x27;s reading goal"[^>]*aria-valuenow="50"/);
  assert.match(html, /Finish book/);
  assert.doesNotMatch(render(h(ReaderToolbar, { title: book.title, session: fakeSession(), isFinished: false, onMarkFinished() {} })), /reading goal/);
  const progress = render(h(ReaderProgress, { percent: 140, label: "Page 3 of 3" }));
  assert.match(progress, /aria-valuenow="100"/);
  assert.match(progress, /Page 3 of 3/);
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
  assert.doesNotMatch(html, /Readwise|Obsidian Markdown|LaTeX|Pomodoro/);
});

test("stats helpers find the peak weekday and count active days in range", () => {
  const days = new Map([["2026-03-01", 30], ["2026-03-08", 90], ["2026-03-02", 20], ["2026-04-01", 0]]);
  assert.deepEqual(statsAggregate.peakWeekday(days), { label: "Sundays", averageMinutes: 60 });
  assert.equal(statsAggregate.peakWeekday(new Map()), null);
  assert.equal(statsAggregate.countActiveDays(days, "2026-03-02", "2026-04-30"), 2);
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
