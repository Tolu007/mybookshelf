# Feature backlog (from the Stitch redesign)

The Stitch screens ("personal reading hub and journal") show features Shelf doesn't have yet. The redesign restyles what exists today and hides anything without data behind it. These are the features to build afterwards, one at a time. Tick each off as it ships.

Items already ticked shipped with the redesign, because the data for them already existed.

Suggested order: cheapest and most visible first.

## Books

- [ ] **Page counts.** Total pages per book ("1,072 p." on cards, "Page 342 / 502" on Currently Reading). PDFs can report it on upload. EPUBs need an estimate or the reader's location count. Needs `books.page_count`.
- [x] **Sort options.** Recently added, recently read, reading progress, title, author.
- [ ] **Sub-tags per category.** Small tags beside each shelf heading ("Stoicism", "Epistemology"). Needs a tags table or a `books.tags` array.

## Journal

- [ ] **Entry titles.** Optional headline per entry ("Observations on cognitive friction…").
- [ ] **Tags.** `#Mindset`-style tags on entries, a tag filter list on the journal page, and tag chips in the reader's session panel.
- [ ] **Book excerpts on entries.** Attach the highlighted passage to a journal entry (shown as a "Book excerpt" quote block).
- [ ] **Formatting toolbar.** Bold, italic, quote, list and link (Markdown) in the writing area.
- [x] **Filter tabs.** All / In-book notes / Standalone / Highlights, with counts.
- [x] **Search.** Across notes, highlighted passages and book titles, with matches marked; works with the tabs.
- [x] **Indexed volumes sidebar.** Books ranked by number of journal entries.
- [ ] **Journal cadence chart.** Entries per day this month.
- [ ] **Export journal.** Download all entries as Markdown.
- [x] **Pagination.** 20 entries a page, keeping the search and tab.
- [ ] **Images on entries.** Optional photo per entry (lowest priority).

## Reader

- [x] **Focus timer controls.** Pause, resume, stop-and-save and start a new session from the reader bar.
- [x] **Daily reading goal.** Set in Settings; shown in the reader bar and on Stats.
- [ ] **Highlight colours.** 4 colours (sage, amber, crimson, slate) in the selection popup, optionally with meanings set in Settings.
- [ ] **Copy / Define** in the selection popup.
- [x] **Session journal side panel.** Collapsible notes panel beside the page (slide-over on phones): write notes pinned to the current page, see and jump to this book's notes, highlights and bookmarks.
- [ ] **Chapter progress.** Chapter markers on the bottom bar, "Chapter 4 of 12", and "~12 min left in chapter". (The bar itself and "page x of y in chapter" shipped.)
- [x] **Reading speed.** Words per minute measured from page turns, with time left in the chapter (EPUB) or book (PDF).
- [ ] **Drop-cap chapter openings.**
- [x] **Reader typography.** Typeface, size, line spacing, column width, page colour, justified text (EPUB).

## Stats

- [x] **Yearly book goal.** "24 / 30 goal" tile with ahead/behind pace.
- [x] **Reading speed on Stats.** Average words per minute for the year, in the Time invested tile.
- [ ] **Best reading window.** The time of day you read most, from session start times.
- [ ] **Genre donut.** Books by category.
- [x] **Finished-books table.** Shelf, completion date, time invested and sessions, for the selected year or all time.
- [x] **Year switcher.** Every year since you started, plus All time (year-by-year chart).
- [ ] **Export stats.** Download as CSV or JSON.

## Settings (beyond the first version)

- [x] **Automatic session pause** after 3, 5 or 10 minutes without a page turn (Settings → Timer & focus).
- [x] **Interval chimes** every 15, 30, 45 or 60 minutes of reading, with a preview in Settings.
- [x] **Pomodoro focus cycles.** Focus 15/25/45/50 min, break 5/10/15 min; breaks pause the session.
- [ ] **Full library export.** Notes, metadata and reading logs as Markdown, JSON or PDF.
- [ ] **Storage usage.** Drive space used by Shelf.
- [ ] **Metadata enrichment.** Look up book details (OpenLibrary) on upload.

## Not planned

These appear in the Stitch screens but don't fit Shelf as built. Revisit only if wanted:

- Star ratings and a "highest rated" sort (built, then removed: not needed for a personal library).
- Audio books, MOBI files.
- Readwise / Obsidian / local-folder sync.
- LaTeX math in notes.
- Email passkey sign-in (Shelf needs Google sign-in to read books from Drive).
- Global search inside book text ("passages") — books live in Google Drive, so full-text search needs an index first.
