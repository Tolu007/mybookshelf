"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Menu } from "lucide-react";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/theme-toggle";
import { SignOutButton } from "@/components/sign-out-button";
import { SidebarNav } from "@/components/sidebar/sidebar-nav";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

function UserFooter({ initials, avatarUrl, displayName }: { initials: string; avatarUrl?: string; displayName: string }) {
  return (
    <div className="mt-5 space-y-4 border-t border-sidebar-border pt-4">
      <ThemeToggle />
      <div className="flex min-w-0 items-center gap-2.5">
        <Avatar className="size-9 ring-2 ring-background">
          <AvatarImage src={avatarUrl} alt="" />
          <AvatarFallback className="bg-accent text-xs text-accent-foreground">{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium">{displayName}</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">Your personal space</p>
        </div>
        <SignOutButton />
      </div>
    </div>
  );
}

export function AppSidebar({ categories, initials, avatarUrl, displayName = "Reader" }: {
  categories: { id: string; name: string }[];
  initials: string;
  avatarUrl?: string;
  displayName?: string;
}) {
  const [open, setOpen] = useState(false);
  const footer = <UserFooter initials={initials} avatarUrl={avatarUrl} displayName={displayName} />;
  return (
    <>
      <aside aria-label="Library navigation" className="hidden h-dvh w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-5 py-7 md:flex lg:w-64">
        <Link href="/" aria-label="Shelf home" className="mb-10 self-start px-2"><Brand /></Link>
        <Suspense><SidebarNav categories={categories} /></Suspense>
        <Link href="/journal" className="mt-6 rounded-xl border border-sidebar-border bg-background/50 p-3.5 transition-colors hover:bg-background">
          <p className="flex items-center justify-between text-xs font-medium">Make it yours <ArrowUpRight className="size-3.5" aria-hidden="true" /></p>
          <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">A thought worth keeping?<br />Give it a home in your journal.</p>
        </Link>
        {footer}
      </aside>
      <header className="flex shrink-0 items-center justify-between border-b border-border bg-sidebar px-5 py-3 md:hidden">
        <Link href="/" aria-label="Shelf home"><Brand className="scale-90 origin-left" /></Link>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger render={<Button variant="outline" size="icon" aria-label="Open navigation menu" />}><Menu /></SheetTrigger>
          <SheetContent side="left" className="w-72 bg-sidebar px-5 py-7">
            <SheetHeader className="mb-5 p-0"><SheetTitle><Brand /></SheetTitle></SheetHeader>
            <Suspense><SidebarNav categories={categories} onNavigate={() => setOpen(false)} /></Suspense>
            {footer}
          </SheetContent>
        </Sheet>
      </header>
    </>
  );
}
