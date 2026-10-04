"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Switch } from "@/components/ui/switch";

const STORAGE_KEY = "shelf-theme";

export function ThemeToggle() {
  const [isDark, setIsDark] = useState<boolean | null>(null);

  useEffect(() => {
    // One-time client-only read to avoid a server/client mismatch — the
    // inline script in layout.tsx already set the real class before paint.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  if (isDark === null) {
    return <div className="size-6" aria-hidden />;
  }

  function toggle(next: boolean) {
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
  }

  return (
    <label className="flex items-center gap-2">
      <Sun className="size-4 text-muted-foreground" aria-hidden />
      <Switch
        checked={isDark}
        onCheckedChange={toggle}
        aria-label="Toggle dark mode"
      />
      <Moon className="size-4 text-muted-foreground" aria-hidden />
    </label>
  );
}
