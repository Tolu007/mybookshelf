"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const [isDark, setIsDark] = useState<boolean | null>(null);
  useEffect(() => {
    // Read after mount; the root's inline script applies the theme before paint.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    try { localStorage.setItem("shelf-theme", next ? "dark" : "light"); } catch { /* The theme still works when storage is unavailable. */ }
  }

  return (
    <Button variant="ghost" className="w-full justify-start gap-3 px-3 text-xs text-muted-foreground" onClick={toggle} disabled={isDark === null} aria-label="Toggle dark mode" aria-pressed={isDark ?? false}>
      {isDark ? <Moon /> : <Sun />}
      {isDark ? "Dark appearance" : "Light appearance"}
      <span className="ml-auto text-[10px]">Switch</span>
    </Button>
  );
}
