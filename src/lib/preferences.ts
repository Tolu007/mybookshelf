// Reading typography, goals and timer behaviour, saved per user in
// user_preferences.
// Everything read from the database goes through parsePreferences, so a
// missing row, an old shape or a bad value all fall back to defaults.

export const READER_FONTS = {
  newsreader: {
    label: "Newsreader",
    note: "Editorial",
    stack: "'Newsreader', Georgia, serif",
    google: "Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,600;1,6..72,400",
  },
  garamond: {
    label: "EB Garamond",
    note: "Classical",
    stack: "'EB Garamond', Garamond, Georgia, serif",
    google: "EB+Garamond:ital,wght@0,400;0,600;1,400",
  },
  literata: {
    label: "Literata",
    note: "Digital modern",
    stack: "'Literata', Georgia, serif",
    google: "Literata:ital,opsz,wght@0,7..72,400;0,7..72,600;1,7..72,400",
  },
  jakarta: {
    label: "Jakarta Sans",
    note: "Crisp sans",
    stack: "'Plus Jakarta Sans', system-ui, sans-serif",
    google: "Plus+Jakarta+Sans:ital,wght@0,400;0,600;1,400",
  },
} as const;

export type ReaderFont = keyof typeof READER_FONTS;

// The same faces as CSS variables from next/font, for previews in the app
// itself. Newsreader and Jakarta are app-wide; pages that preview Garamond
// and Literata add their variables (lib/reader-fonts.ts).
export const READER_FONT_VARS: Record<ReaderFont, string> = {
  newsreader: "var(--font-newsreader)",
  garamond: "var(--font-garamond)",
  literata: "var(--font-literata)",
  jakarta: "var(--font-jakarta)",
};

export const LINE_HEIGHTS = [
  { value: 1.4, label: "Compact" },
  { value: 1.65, label: "Classic" },
  { value: 1.9, label: "Airy" },
] as const;

// Column width in characters.
export const MEASURES = [
  { value: 60, label: "Narrow" },
  { value: 72, label: "Optimal" },
  { value: 90, label: "Broad" },
] as const;

// "auto" follows the app's light/dark theme.
export const PAPERS = {
  auto: { label: "Match theme", background: null, color: null },
  parchment: { label: "Parchment", background: "#fdfbf7", color: "#1c1b1b" },
  sepia: { label: "Sepia", background: "#f4ecd8", color: "#3b2f1e" },
  candle: { label: "Candlelight", background: "#2a2118", color: "#ecdcc0" },
  obsidian: { label: "Obsidian", background: "#121614", color: "#e8e4dc" },
} as const;

export type Paper = keyof typeof PAPERS;

export const FONT_SIZE_RANGE = { min: 14, max: 28 } as const;

// Minutes without a page turn before the session clock pauses itself.
export const AUTO_PAUSE_OPTIONS = [3, 5, 10] as const;

// Minutes of reading between chimes.
export const CHIME_OPTIONS = [15, 30, 45, 60] as const;

export const FOCUS_OPTIONS = [15, 25, 45, 50] as const;
export const BREAK_OPTIONS = [5, 10, 15] as const;

export type Preferences = {
  reader: {
    font: ReaderFont;
    fontSize: number;
    lineHeight: number;
    measure: number;
    paper: Paper;
    justify: boolean;
  };
  goals: {
    // null means no goal.
    dailyMinutes: number | null;
    yearlyBooks: number | null;
  };
  timer: {
    // null means off.
    autoPauseMinutes: number | null;
    chimeMinutes: number | null;
    pomodoro: boolean;
    focusMinutes: number;
    breakMinutes: number;
  };
};

export const DEFAULT_PREFERENCES: Preferences = {
  reader: { font: "newsreader", fontSize: 18, lineHeight: 1.65, measure: 72, paper: "auto", justify: false },
  goals: { dailyMinutes: null, yearlyBooks: null },
  timer: { autoPauseMinutes: null, chimeMinutes: null, pomodoro: false, focusMinutes: 25, breakMinutes: 5 },
};

function pick<T>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function wholeNumber(value: unknown, min: number, max: number): number | null {
  const number = typeof value === "number" ? Math.round(value) : NaN;
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
}

export function parsePreferences(raw: unknown): Preferences {
  const source = (raw && typeof raw === "object" ? raw : {}) as Record<string, Record<string, unknown> | undefined>;
  const reader = source.reader ?? {};
  const goals = source.goals ?? {};
  const timer = source.timer ?? {};
  const defaults = DEFAULT_PREFERENCES.reader;
  return {
    reader: {
      font: pick(reader.font, Object.keys(READER_FONTS) as ReaderFont[], defaults.font),
      fontSize: wholeNumber(reader.fontSize, FONT_SIZE_RANGE.min, FONT_SIZE_RANGE.max) ?? defaults.fontSize,
      lineHeight: pick(reader.lineHeight, LINE_HEIGHTS.map((option) => option.value), defaults.lineHeight),
      measure: pick(reader.measure, MEASURES.map((option) => option.value), defaults.measure),
      paper: pick(reader.paper, Object.keys(PAPERS) as Paper[], defaults.paper),
      justify: typeof reader.justify === "boolean" ? reader.justify : defaults.justify,
    },
    goals: {
      dailyMinutes: wholeNumber(goals.dailyMinutes, 5, 600),
      yearlyBooks: wholeNumber(goals.yearlyBooks, 1, 500),
    },
    timer: {
      autoPauseMinutes: pick<number | null>(timer.autoPauseMinutes, AUTO_PAUSE_OPTIONS, null),
      chimeMinutes: pick<number | null>(timer.chimeMinutes, CHIME_OPTIONS, null),
      pomodoro: typeof timer.pomodoro === "boolean" ? timer.pomodoro : false,
      focusMinutes: pick<number>(timer.focusMinutes, FOCUS_OPTIONS, 25),
      breakMinutes: pick<number>(timer.breakMinutes, BREAK_OPTIONS, 5),
    },
  };
}

// Google Fonts stylesheet for the reader's iframe, which can't see the
// app's self-hosted fonts.
export function readerFontStylesheet(font: ReaderFont) {
  return `https://fonts.googleapis.com/css2?family=${READER_FONTS[font].google}&display=swap`;
}

// Approximate pixel width for a column of `measure` characters.
export function columnWidthPx(measure: number, fontSize: number) {
  return Math.round(measure * fontSize * 0.5);
}
