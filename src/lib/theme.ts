// Theme choice lives in localStorage (per device) and is applied before
// paint by the inline script in the root layout. "system" means no stored
// choice: follow the OS setting.
export type ThemeChoice = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "shelf-theme";

export function readThemeChoice(): ThemeChoice {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

export function applyThemeChoice(choice: ThemeChoice) {
  const dark =
    choice === "dark" ||
    (choice === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  try {
    if (choice === "system") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // The theme still applies for this visit when storage is unavailable.
  }
}
