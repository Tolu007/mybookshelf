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
});

test("sign-in screen renders without credentials and retains its Google action", () => {
  const html = render(h(LoginPage), "/login");
  assert.match(html, /Continue with Google/);
  assert.match(html, /Make yourself at home/);
  assert.match(html, /Your PDFs and EPUBs/);
});
