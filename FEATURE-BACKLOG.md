# Feature backlog (from the Stitch redesign)

The Stitch screens ("personal reading hub and journal") show features Shelf doesn't have yet. The redesign restyles what exists today and hides anything without data behind it. These are the features to build afterwards, one at a time. Tick each off as it ships.

Suggested order: cheapest and most visible first.

## Books

- [ ] **Star ratings.** A 1–5 rating on each book (half stars in the design), shown on book cards, Currently Reading cards, and the finished-books table on Stats. Needs `books.rating`.
- [ ] **Page counts.** Total pages per book ("1,072 p." on cards, "Page 342 / 502" on Currently Reading). PDFs can report it on upload. EPUBs need an estimate or the reader's location count. Needs `books.page_count`.
- [ ] **Sort options.** "Highest rated" sort on the library (needs ratings). "Recently read" and "Reading progress" can ship with the redesign.
- [ ] **Sub-tags per category.** Small tags beside each shelf heading ("Stoicism", "Epistemology"). Needs a tags table or a `books.tags` array.

## Journal

- [ ] **Entry titles.** Optional headline per entry ("Observations on cognitive friction…").
- [ ] **Tags.** `#Mindset`-style tags on entries, a tag filter list on the journal page, and tag chips in the reader's session panel.
- [ ] **Book excerpts on entries.** Attach the highlighted passage to a journal entry (shown as a "Book excerpt" quote block).
- [ ] **Formatting toolbar.** Bold, italic, quote, list and link (Markdown) in the writing area.
- [ ] **Filter tabs.** All / In-book notes / Standalone / Quotes & highlights, with counts.
- [ ] **Indexed volumes sidebar.** Books ranked by number of journal entries.
- [ ] **Journal cadence chart.** Entries per day this month.
- [ ] **Export journal.** Download all entries as Markdown.
- [ ] **Pagination.** "Previous / Next" once the journal gets long.
- [ ] **Images on entries.** Optional photo per entry (lowest priority).

## Reader

- [ ] **Focus timer controls.** Visible session timer with pause/stop in the reader bar (sessions are already timed in the background).
- [ ] **Daily reading goal.** Goal minutes per day, shown as a progress bar in the reader and on Stats. Pairs with the Settings goal field.
- [ ] **Highlight colours.** 4 colours (sage, amber, crimson, slate) in the selection popup, optionally with meanings set in Settings.
- [ ] **Copy / Define** in the selection popup.
- [ ] **Session journal side panel.** Write notes and see this book's notes and highlights in a side panel instead of a dialog.
- [ ] **Chapter progress.** Bottom bar with chapter markers, "Chapter 4 of 12", and "~12 min left in chapter".
- [ ] **Reading speed.** Words or pages per minute, shown in the reader and on Stats.
- [ ] **Drop-cap chapter openings and justified text** (reader typography options).

## Stats

- [ ] **Yearly book goal.** "24 / 30 goal" tile with ahead/behind pace.
- [ ] **Reading speed tile.** Pages per hour (needs page counts).
- [ ] **Best reading window.** The time of day you read most, from session start times.
- [ ] **Genre donut.** Books by category.
- [ ] **Finished-books table.** Completion date, time invested, sessions, pace, rating.
- [ ] **Year switcher.** 2024 / 2023 / All-time on the stats page.
- [ ] **Export stats.** Download as CSV or JSON.

## Settings (beyond the first version)

- [ ] **Automatic session pause** after N minutes without a page turn.
- [ ] **Interval chimes** (sound at 15/30/45 minutes).
- [ ] **Pomodoro focus cycles.**
- [ ] **Full library export.** Notes, metadata and reading logs as Markdown, JSON or PDF.
- [ ] **Storage usage.** Drive space used by Shelf.
- [ ] **Metadata enrichment.** Look up book details (OpenLibrary) on upload.

## Not planned

These appear in the Stitch screens but don't fit Shelf as built. Revisit only if wanted:

- Audio books, MOBI files.
- Readwise / Obsidian / local-folder sync.
- LaTeX math in notes.
- Email passkey sign-in (Shelf needs Google sign-in to read books from Drive).
- Global search inside book text ("passages") — books live in Google Drive, so full-text search needs an index first.
