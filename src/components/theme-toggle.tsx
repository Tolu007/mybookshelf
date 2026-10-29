"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { applyThemeChoice } from "@/lib/theme";

// A user-menu item that flips between light and dark.
export function ThemeMenuItem() {
  const [isDark, setIsDark] = useState<boolean | null>(null);
  useEffect(() => {
    // Read after mount; the root's inline script applies the theme before paint.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  return (
    <DropdownMenuItem
      closeOnClick={false}
      disabled={isDark === null}
      onClick={() => {
        const next = !isDark;
        setIsDark(next);
        applyThemeChoice(next ? "dark" : "light");
      }}
    >
      {isDark ? <Sun /> : <Moon />}
      {isDark ? "Light appearance" : "Dark appearance"}
    </DropdownMenuItem>
  );
}
