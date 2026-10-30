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
