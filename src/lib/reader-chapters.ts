// Chapters for the reader's bar and progress line, from an EPUB's table
// of contents or a PDF's outline. `start` is where the chapter begins: a
// spine index for EPUBs, a page number for PDFs.

export type ReaderChapter = {
  label: string;
  start: number;
  // Where the chapter begins as a share of the book (0–1), once known.
  position: number | null;
};

export type ChapterPlace = {
  number: number;
  count: number;
  chapter: ReaderChapter;
  next: ReaderChapter | null;
};

// The chapter containing `at` (spine index or page), if any.
export function chapterAt(chapters: ReaderChapter[], at: number): ChapterPlace | null {
  let index = -1;
  for (let i = 0; i < chapters.length; i++) {
    if (chapters[i].start <= at) index = i;
  }
  if (index < 0) return null;
  return { number: index + 1, count: chapters.length, chapter: chapters[index], next: chapters[index + 1] ?? null };
}

// One entry per start point, in reading order, without blank labels.
export function tidyChapters(chapters: { label: string; start: number; position?: number | null }[]): ReaderChapter[] {
  const seen = new Set<number>();
  return chapters
    .map((chapter) => ({ label: chapter.label.replace(/\s+/g, " ").trim(), start: chapter.start, position: chapter.position ?? null }))
    .filter((chapter) => chapter.label && !seen.has(chapter.start) && seen.add(chapter.start))
    .sort((a, b) => a.start - b.start);
}

// EPUB chapter positions from the book's generated locations: the share of
// locations before the chapter's first one. `cfiBase` identifies the
// chapter's spine item inside each location CFI.
export function chapterPositions(locationCfis: string[], cfiBases: string[]) {
  return cfiBases.map((cfiBase) => {
    const index = locationCfis.findIndex((cfi) => cfi.startsWith(`epubcfi(${cfiBase}!`));
    return index < 0 || locationCfis.length === 0 ? null : index / locationCfis.length;
  });
}
