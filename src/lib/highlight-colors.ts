// Highlight colours. Each one is a translucent wash laid over the page, so
// the text under it stays readable on light and dark paper alike.

export const HIGHLIGHT_COLORS = [
  { key: "amber", label: "Amber", fill: "#d97736" },
  { key: "sage", label: "Sage", fill: "#4f9a72" },
  { key: "crimson", label: "Crimson", fill: "#c8414b" },
  { key: "slate", label: "Slate", fill: "#5b7ba0" },
] as const;

export type HighlightColor = (typeof HIGHLIGHT_COLORS)[number]["key"];

export const DEFAULT_HIGHLIGHT_COLOR: HighlightColor = "amber";
export const HIGHLIGHT_OPACITY = 0.35;

export function isHighlightColor(value: unknown): value is HighlightColor {
  return HIGHLIGHT_COLORS.some((color) => color.key === value);
}

// Saved highlights from before colours existed have none: they're amber.
export function highlightColor(value: unknown) {
  return HIGHLIGHT_COLORS.find((color) => color.key === value) ?? HIGHLIGHT_COLORS[0];
}

// The fill as an rgba() wash, for the PDF overlay.
export function highlightWash(value: unknown, opacity = HIGHLIGHT_OPACITY) {
  const hex = highlightColor(value).fill.slice(1);
  const [r, g, b] = [0, 2, 4].map((start) => parseInt(hex.slice(start, start + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

// The colour you last picked in the reader, remembered on this device.
const STORAGE_KEY = "shelf-highlight-color";

export function loadHighlightColor(): HighlightColor {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isHighlightColor(stored) ? stored : DEFAULT_HIGHLIGHT_COLOR;
  } catch {
    return DEFAULT_HIGHLIGHT_COLOR;
  }
}

export function saveHighlightColor(color: HighlightColor) {
  try {
    localStorage.setItem(STORAGE_KEY, color);
  } catch {
    // Private browsing or storage full: the choice lasts for this visit.
  }
}

const CHANGE_EVENT = "shelf-highlight-color";

// For useSyncExternalStore: the picked colour, shared by every reader
// control on the page and kept in step across tabs.
export function subscribeHighlightColor(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function pickHighlightColor(color: HighlightColor) {
  saveHighlightColor(color);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}
