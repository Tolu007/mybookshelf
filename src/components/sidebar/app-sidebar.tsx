"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/theme-toggle";
import { SignOutButton } from "@/components/sign-out-button";
import { SidebarNav } from "@/components/sidebar/sidebar-nav";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

function UserFooter({ initials, avatarUrl }: { initials: string; avatarUrl?: string }) {
  return (
    <div className="flex items-center justify-between border-t border-border pt-4">
      <div className="flex items-center gap-2">
        <Avatar className="size-8">
          <AvatarImage src={avatarUrl} alt="" />
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <ThemeToggle />
      </div>
      <SignOutButton />
    </div>
  );
}

export function AppSidebar({
  categories,
  initials,
  avatarUrl,
}: {
  categories: { id: string; name: string }[];
  initials: string;
  avatarUrl?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <aside className="hidden h-dvh w-64 shrink-0 flex-col border-r border-border bg-sidebar px-4 py-6 md:flex">
        <Link href="/" className="mb-8 px-3 font-heading text-xl font-medium">
          Shelf
        </Link>
        <Suspense>
          <SidebarNav categories={categories} />
        </Suspense>
        <UserFooter initials={initials} avatarUrl={avatarUrl} />
      </aside>

      <header className="flex items-center justify-between border-b border-border px-4 py-3 md:hidden">
        <Link href="/" className="font-heading text-lg font-medium">
          Shelf
        </Link>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Open menu" />}>
            <Menu />
          </SheetTrigger>
          <SheetContent side="left" className="w-72 px-4 py-6">
            <SheetHeader className="p-0">
              <SheetTitle>Shelf</SheetTitle>
            </SheetHeader>
            <Suspense>
              <SidebarNav categories={categories} onNavigate={() => setOpen(false)} />
            </Suspense>
            <UserFooter initials={initials} avatarUrl={avatarUrl} />
          </SheetContent>
        </Sheet>
      </header>
    </>
  );
}
