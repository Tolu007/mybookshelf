import { createClient } from "@/lib/supabase/server";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { BookOpen, ArrowUpRight } from "lucide-react";
import Link from "next/link";

function initialsFor(user: { user_metadata?: Record<string, unknown>; email?: string }) {
  const name =
    (user.user_metadata?.full_name as string | undefined) ?? user.email ?? "?";
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: categories } = await supabase
    .from("categories")
    .select("id, name")
    .order("name");

  return (
    <div className="flex h-dvh overflow-hidden flex-col md:flex-row">
      <a href="#main-content" className="sr-only z-50 rounded-lg bg-card p-3 focus:not-sr-only focus:absolute focus:top-3 focus:left-3">Skip to content</a>
      <AppSidebar
        categories={categories ?? []}
        initials={initialsFor(user)}
        avatarUrl={user.user_metadata?.avatar_url as string | undefined}
        displayName={typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : "Reader"}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="hidden h-16 shrink-0 items-center justify-between border-b border-border/80 px-8 md:flex lg:px-12">
          <span className="flex items-center gap-2 text-[11px] text-muted-foreground"><BookOpen className="size-3.5" aria-hidden="true" /> A home for your reading life</span>
          <Link href="/journal" className="flex items-center gap-1.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground">Your journal <ArrowUpRight className="size-3.5" aria-hidden="true" /></Link>
        </div>
        <main id="main-content" tabIndex={-1} className="min-h-0 min-w-0 flex-1 overflow-y-auto outline-none">{children}</main>
      </div>
    </div>
  );
}
