"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Flame, LogOut, Menu, Search, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeMenuItem } from "@/components/theme-toggle";
import { createClient } from "@/lib/supabase/client";

export type ShellUser = {
  displayName: string;
  email: string | null;
  initials: string;
  avatarUrl?: string;
};

function SearchField({ defaultValue }: { defaultValue?: string }) {
  return (
    <form action="/" method="get" role="search" className="relative w-full max-w-lg">
      <label htmlFor="global-search" className="sr-only">Search your library by title or author</label>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <input
        id="global-search"
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder="Search titles and authors…"
        className="h-9 w-full rounded-lg border border-border bg-card pr-3 pl-9 text-[13px] text-foreground transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-sage/60 focus-visible:bg-background focus-visible:ring-3 focus-visible:ring-primary/15 dark:bg-secondary dark:focus-visible:bg-popover"
      />
    </form>
  );
}

// Keeps the box filled with the active query on the library page.
function SearchFromParams() {
  const query = useSearchParams().get("q") ?? undefined;
  return <SearchField key={query} defaultValue={query} />;
}

function UserMenu({ user }: { user: ShellUser }) {
  const router = useRouter();

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<button type="button" aria-label="Account menu" className="flex items-center gap-2.5 rounded-lg py-1 pr-1 pl-2 transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:outline-ring" />}
      >
        <span className="hidden flex-col items-end leading-none sm:flex">
          <span className="max-w-40 truncate text-[13px] font-semibold">{user.displayName}</span>
          <span className="mt-1 text-[10px] tracking-[0.06em] text-muted-foreground uppercase">Reader</span>
        </span>
        <Avatar className="size-8 ring-1 ring-border">
          <AvatarImage src={user.avatarUrl} alt="" />
          <AvatarFallback className="bg-accent text-xs font-semibold text-accent-foreground">{user.initials}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col gap-0.5 py-2">
            <span className="truncate text-sm font-semibold text-foreground">{user.displayName}</span>
            {user.email && <span className="truncate text-xs font-normal text-muted-foreground">{user.email}</span>}
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/settings" />}>
          <Settings2 /> Settings
        </DropdownMenuItem>
        <ThemeMenuItem />
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut}>
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function TopBar({
  user,
  streak,
  onOpenMenu,
}: {
  user: ShellUser;
  streak: number;
  onOpenMenu: () => void;
}) {
  return (
    <header className="z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-sidebar/90 px-4 backdrop-blur-xl sm:h-16 sm:px-6">
      <Button variant="outline" size="icon" onClick={onOpenMenu} aria-label="Open navigation menu" className="md:hidden">
        <Menu />
      </Button>
      <div className="min-w-0 flex-1">
        <Suspense fallback={<SearchField />}>
          <SearchFromParams />
        </Suspense>
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <span title={`${streak}-day reading streak`} className="hidden items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-semibold text-amber tabular-nums sm:flex dark:bg-secondary">
          <Flame className="size-3.5" aria-hidden="true" /> {streak}-day streak
        </span>
        <UserMenu user={user} />
      </div>
    </header>
  );
}
