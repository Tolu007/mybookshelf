"use client";

import type { ComponentType, ReactNode } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { BarChart3, Bookmark, CheckCircle2, Heart, LibraryBig } from "lucide-react";
import { cn } from "@/lib/utils";

const SHELVES: { key: string; label: string; icon: ComponentType<{ className?: string }> }[] = [
  { key: "reading", label: "Reading", icon: LibraryBig },
  { key: "want_to_read", label: "Want to Read", icon: Bookmark },
  { key: "finished", label: "Finished", icon: CheckCircle2 },
  { key: "favorites", label: "Favorites", icon: Heart },
];

function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
        active
          ? "bg-accent font-medium text-accent-foreground"
          : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
      )}
    >
      {children}
    </Link>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="px-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">
      {children}
    </p>
  );
}

export function SidebarNav({
  categories,
  onNavigate,
}: {
  categories: { id: string; name: string }[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const shelf = searchParams.get("shelf");
  const category = searchParams.get("category");
  const onLibraryRoute = pathname === "/";

  return (
    <nav className="flex flex-1 flex-col gap-6 overflow-y-auto" onClick={onNavigate}>
      <div className="space-y-0.5">
        <NavLink href="/" active={onLibraryRoute && !shelf && !category}>
          <LibraryBig className="size-4" />
          Library
        </NavLink>
        <NavLink href="/stats" active={pathname === "/stats"}>
          <BarChart3 className="size-4" />
          Stats
        </NavLink>
      </div>

      <div className="space-y-0.5">
        <SectionLabel>Shelves</SectionLabel>
        {SHELVES.map((item) => (
          <NavLink
            key={item.key}
            href={`/?shelf=${item.key}`}
            active={onLibraryRoute && shelf === item.key}
          >
            <item.icon className="size-4" />
            {item.label}
          </NavLink>
        ))}
      </div>

      {categories.length > 0 && (
        <div className="space-y-0.5">
          <SectionLabel>Categories</SectionLabel>
          {categories.map((item) => (
            <NavLink
              key={item.id}
              href={`/?category=${item.id}`}
              active={onLibraryRoute && category === item.id}
            >
              <span className="ml-0.5 size-1.5 shrink-0 rounded-full bg-current opacity-50" />
              <span className="truncate">{item.name}</span>
            </NavLink>
          ))}
        </div>
      )}
    </nav>
  );
}
