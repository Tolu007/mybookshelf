"use client";

import type { ComponentType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, ChartNoAxesColumn, Flame, LibraryBig, NotebookPen, PanelLeftClose, PanelLeftOpen, Settings2, X } from "lucide-react";
import { Brand } from "@/components/brand";
import { AddBookDialog } from "@/components/add-book-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type NavItem = {
  label: string;
  href: string | null;
  icon: ComponentType<{ className?: string }>;
  active: (pathname: string) => boolean;
  disabledHint?: string;
};

function navItems(activeBookId: string | null): NavItem[] {
  return [
    { label: "Shelf", href: "/", icon: LibraryBig, active: (path) => path === "/" },
    {
      label: "Active reader",
      href: activeBookId ? `/read/${activeBookId}` : null,
      icon: BookOpen,
      active: (path) => path.startsWith("/read/"),
      disabledHint: "Open a book to start reading",
    },
    { label: "Statistics", href: "/stats", icon: ChartNoAxesColumn, active: (path) => path === "/stats" },
    { label: "Journal", href: "/journal", icon: NotebookPen, active: (path) => path === "/journal" },
    { label: "Settings", href: "/settings", icon: Settings2, active: (path) => path === "/settings" },
  ];
}

const itemClass =
  "flex min-h-10 items-center gap-3 rounded-lg border px-3 py-2 text-sm font-semibold tracking-[0.02em] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

export function SidebarContent({
  collapsed,
  categories,
  activeBookId,
  streak,
  onToggleCollapsed,
  onClose,
  onNavigate,
}: {
  collapsed: boolean;
  categories: { id: string; name: string }[];
  activeBookId: string | null;
  streak: { current: number; longest: number };
  // Desktop: collapse to an icon rail. Mobile drawer: close the drawer.
  onToggleCollapsed?: () => void;
  onClose?: () => void;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <div className={cn("flex h-full flex-col gap-6 py-5", collapsed ? "px-2.5" : "px-4")}>
      <div className={cn("flex items-center gap-2", collapsed ? "flex-col" : "justify-between")}>
        <Link href="/" aria-label="Shelf home" className="min-w-0 rounded-lg focus-visible:outline-2 focus-visible:outline-ring" onClick={onNavigate}>
          <Brand compact={collapsed} />
        </Link>
        {onToggleCollapsed && (
          <Button variant="ghost" size="icon-sm" onClick={onToggleCollapsed} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed} title={collapsed ? "Expand sidebar" : "Collapse sidebar"} className="text-muted-foreground">
            {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
          </Button>
        )}
        {onClose && (
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close navigation" className="text-muted-foreground">
            <X />
          </Button>
        )}
      </div>

      <AddBookDialog categories={categories} compact={collapsed} triggerClassName="w-full" />

      <nav aria-label="Main navigation" className="flex flex-col gap-1">
        {navItems(activeBookId).map((item) => {
          const active = item.active(pathname);
          const content = (
            <>
              <item.icon className="size-[18px] shrink-0" />
              <span className={cn(collapsed && "sr-only")}>{item.label}</span>
            </>
          );
          if (!item.href) {
            return (
              <span key={item.label} aria-disabled="true" title={item.disabledHint} className={cn(itemClass, "cursor-not-allowed border-transparent text-muted-foreground/60", collapsed && "justify-center px-0")}>
                {content}
              </span>
            );
          }
          return (
            <Link
              key={item.label}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              title={collapsed ? item.label : undefined}
              className={cn(
                itemClass,
                collapsed && "justify-center px-0",
                active
                  ? "border-primary/25 bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                  : "border-transparent text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              {content}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto">
        {collapsed ? (
          <div title={`${streak.current}-day reading streak`} className="flex flex-col items-center gap-0.5 rounded-lg border border-border bg-card py-2 text-amber">
            <Flame className="size-4" aria-hidden="true" />
            <span className="text-[11px] font-semibold tabular-nums">{streak.current}<span className="sr-only">-day reading streak</span></span>
          </div>
        ) : (
          <div className="space-y-1.5 rounded-xl border border-border bg-card p-3 shadow-inner">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium tracking-[0.06em] text-muted-foreground uppercase">Reading cadence</span>
              <Flame className="size-4 text-amber" aria-hidden="true" />
            </div>
            <p className="text-xs font-semibold text-amber tabular-nums">{streak.current}-day streak</p>
            <p className="text-[11px] leading-snug text-muted-foreground">
              {streak.current > 0
                ? `Longest so far: ${streak.longest} ${streak.longest === 1 ? "day" : "days"}.`
                : "Read today to start a new streak."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
