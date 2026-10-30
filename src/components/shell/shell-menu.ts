"use client";

import { createContext, useContext } from "react";

// Lets pages without the top bar (the reader) open the mobile navigation
// drawer from their own header.
export const ShellMenuContext = createContext<(() => void) | null>(null);

export function useOpenShellMenu() {
  return useContext(ShellMenuContext);
}
