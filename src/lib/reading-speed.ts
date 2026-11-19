// Reading speed from page turns: words on each page you finish, over the
// reading time you spent on it.

// Below this many measured words, a session's speed is too noisy to show,
// so the reader falls back to your average from past sessions.
export const MIN_SAMPLE_WORDS = 300;

export function countWords(text: string) {
  return text.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu)?.length ?? 0;
}

// Skips flips (too fast to be reading) and long stays (stepped away).
export function isPlausiblePage(words: number, seconds: number) {
  if (words <= 0 || seconds < 3 || seconds > 15 * 60) return false;
  const wpm = words / (seconds / 60);
  return wpm >= 40 && wpm <= 1200;
}

export function wordsPerMinute(words: number, seconds: number) {
  return seconds > 0 && words > 0 ? Math.round(words / (seconds / 60)) : null;
}

export function formatTimeLeft(minutes: number) {
  if (minutes < 1) return "under a minute";
  const total = Math.round(minutes);
  if (total < 60) return `${total} min`;
  return `${Math.floor(total / 60)}h ${total % 60}m`;
}

export type SpeedSample = { words: number; seconds: number };

// Adds the page just left to the sample when it was read, not flipped past
// or left open: only forward turns, with a known word count, at a
// plausible pace.
export function addPageToSample(sample: SpeedSample, page: { words: number | null; seconds: number }, forward: boolean): SpeedSample {
  if (!forward || page.words === null || !isPlausiblePage(page.words, page.seconds)) return sample;
  return { words: sample.words + page.words, seconds: sample.seconds + page.seconds };
}

// This session's speed once enough is measured, else your past average.
export function currentWpm(sample: SpeedSample, averageWpm: number | null) {
  return sample.words >= MIN_SAMPLE_WORDS ? wordsPerMinute(sample.words, sample.seconds) : averageWpm;
}

// What the reader shows: the speed, or that it's still being measured.
export function speedLabel(wpm: number | null) {
  return wpm ? `${wpm} wpm` : "measuring…";
}
