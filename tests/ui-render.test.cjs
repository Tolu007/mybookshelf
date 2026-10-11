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
const { ReadingHero } = require("../src/components/reading-hero.tsx");
const { LibraryCollection } = require("../src/components/library-collection.tsx");
const { SidebarNav } = require("../src/components/sidebar/sidebar-nav.tsx");
const { JournalList } = require("../src/components/journal/journal-list.tsx");
const { NewNoteDialog } = require("../src/components/journal/new-note-dialog.tsx");
const { ReaderToolbar } = require("../src/components/readers/reader-toolbar.tsx");
const { ReadingBarChart } = require("../src/components/stats/reading-bar-chart.tsx");
const { ReaderLoadStatus } = require("../src/components/readers/reader-load-status.tsx");
const { downloadBook, readerErrorMessage, readerErrorState } = require("../src/lib/book-download.ts");
const { classifyBookFileError, DriveAccessError } = require("../src/lib/book-file-errors.ts");
const LoginPage = require("../src/app/login/page.tsx").default;

const router = { back() {}, forward() {}, refresh() {}, push() {}, replace() {}, prefetch() {} };
function render(element, pathname = "/", query = "") {
  return renderToStaticMarkup(React.createElement(AppRouterContext.Provider, { value: router },
    React.createElement(PathnameContext.Provider, { value: pathname },
      React.createElement(SearchParamsContext.Provider, { value: new URLSearchParams(query) },
        React.createElement(ImageConfigContext.Provider, { value: imageConfig }, element)))));
}
const h = React.createElement;
const book = { id: "book-1", title: "A thoughtful book", author: "A Reader", cover_url: null, format: "epub", want_to_read: false, is_favorite: false, category_id: null };
const note = { id: "note-1", note: "An idea worth keeping.", location: "epubcfi(/6/2[chapter]!/4/1:0)", createdAt: "2026-10-11T12:00:00Z", book: { id: book.id, title: book.title, coverUrl: null } };

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

test("reading hero renders an honest empty state or resumes the actual current book", () => {
  const empty = render(h(ReadingHero));
  assert.match(empty, /A quieter corner/);
  assert.doesNotMatch(empty, /Continue reading/);
  const current = render(h(ReadingHero, { current: { book, percent: 42.4 } }));
  assert.match(current, /42% read/);
  assert.match(current, /href="\/read\/book-1"/);
  assert.match(current, /Continue reading/);
});

test("collection has labeled sorting and view controls, and keeps input order by default", () => {
  const html = render(h(LibraryCollection, { books: [book, { ...book, id: "book-2", title: "Another book" }], categories: [] }));
  assert.match(html, /2 books in this collection/);
  assert.match(html, /aria-label="Sort books"/);
  assert.match(html, /aria-label="Grid view" aria-pressed="true"/);
  assert.match(html, /aria-label="List view" aria-pressed="false"/);
  assert.ok(html.indexOf('/read/book-1') < html.indexOf('/read/book-2'));
});

test("navigation preserves shelf, category, journal, and stats routes and active state", () => {
  const html = render(h(SidebarNav, { categories: [{ id: "category-1", name: "Fiction" }] }), "/", "shelf=favorites");
  const favoritesLink = (html.match(/<a\b[^>]*>/g) ?? []).find((tag) => tag.includes('href="/?shelf=favorites"'));
  assert.ok(favoritesLink);
  assert.match(favoritesLink, /aria-current="page"/);
  assert.match(html, /href="\/\?category=category-1"/);
  assert.match(html, /href="\/journal"/);
  assert.match(html, /href="\/stats"/);
});

test("journal handles empty notes and links back to the exact annotation location", () => {
  assert.match(render(h(JournalList, { initialNotes: [] })), /Good thoughts deserve a place/);
  const html = render(h(JournalList, { initialNotes: [note] }));
  assert.match(html, /An idea worth keeping/);
  assert.match(html, /href="\/read\/book-1\?location=epubcfi/);
  assert.match(html, /aria-label="Delete note from A thoughtful book"/);
});

test("new-note action is disabled until a book has a saved reading location", () => {
  const html = render(h(NewNoteDialog, { booksInProgress: [] }));
  assert.match(html, /disabled=""/);
  assert.match(html, /Start reading a book first/);
  const enabled = render(h(NewNoteDialog, { booksInProgress: [{ id: book.id, title: book.title, location: "1" }] }));
  assert.match(enabled, /New note/);
  assert.doesNotMatch(enabled, /disabled=""/);
});

test("reader toolbar retains back navigation, reading controls, and finished state", () => {
  const html = render(h(ReaderToolbar, { title: book.title, elapsedSeconds: 120, isFinished: true, onMarkFinished() {} }, h("button", { "aria-label": "Next page" }, "Next")));
  assert.match(html, /aria-label="Back to your library"/);
  assert.match(html, /aria-label="Reading controls"/);
  assert.match(html, /2m this session/);
  assert.match(html, /disabled=""/);
  assert.match(html, /Finished/);
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
  assert.match(html, /Make yourself at home/);
  assert.match(html, /Your PDFs and EPUBs/);
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
