"use client";

import { useState, type ReactNode } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { SidebarContent } from "@/components/shell/sidebar-content";
import { TopBar, type ShellUser } from "@/components/shell/top-bar";
import { SIDEBAR_COOKIE } from "@/lib/sidebar";
import { cn } from "@/lib/utils";

export function ShellFrame({
  children,
  initialCollapsed,
  fill,
  user,
  streak,
  activeBookId,
  categories,
}: {
  children: ReactNode;
  initialCollapsed: boolean;
  // Readers fill the viewport and manage their own scrolling.
  fill: boolean;
  user: ShellUser;
  streak: { current: number; longest: number };
  activeBookId: string | null;
  categories: { id: string; name: string }[];
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    // A cookie (not localStorage) so the server renders the right width and
    // the sidebar doesn't jump on load.
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "collapsed" : "expanded"}; path=/; max-age=31536000; samesite=lax`;
  }

  const shared = { categories, activeBookId, streak };

  return (
    <div className="flex h-dvh overflow-hidden">
      <a href="#main-content" className="sr-only z-50 rounded-lg bg-card p-3 focus:not-sr-only focus:absolute focus:top-3 focus:left-3">Skip to content</a>
      <aside
        aria-label="Sidebar"
        className={cn(
          "hidden shrink-0 border-r border-sidebar-border bg-sidebar transition-[width] duration-200 ease-out md:block",
          collapsed ? "w-[72px]" : "w-64"
        )}
      >
        <SidebarContent collapsed={collapsed} onToggleCollapsed={toggleCollapsed} {...shared} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar user={user} streak={streak.current} onOpenMenu={() => setMobileOpen(true)} />
        <main
          id="main-content"
          tabIndex={-1}
          className={cn("min-h-0 min-w-0 flex-1 outline-none", fill ? "flex flex-col overflow-hidden" : "overflow-y-auto")}
        >
          {children}
        </main>
      </div>
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" showCloseButton={false} className="w-72 gap-0 border-sidebar-border bg-sidebar p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarContent collapsed={false} onClose={() => setMobileOpen(false)} onNavigate={() => setMobileOpen(false)} {...shared} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
