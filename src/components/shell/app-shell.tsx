import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { ShellFrame } from "@/components/shell/shell-frame";
import { SIDEBAR_COOKIE } from "@/lib/sidebar";

function initialsFor(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "?";
}

export async function AppShell({ children, fill = false }: { children: ReactNode; fill?: boolean }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The (app) layout already redirects signed-out visitors.
  if (!user) return null;

  const [{ data: categories }, { data: stats }, { data: lastRead }, cookieStore] = await Promise.all([
    supabase.from("categories").select("id, name").order("name"),
    supabase.from("user_stats").select("current_streak, longest_streak").eq("user_id", user.id).maybeSingle(),
    supabase.from("reading_progress").select("book_id").order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    cookies(),
  ]);

  const fullName = typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : null;
  const displayName = fullName ?? user.email?.split("@")[0] ?? "Reader";

  return (
    <ShellFrame
      fill={fill}
      initialCollapsed={cookieStore.get(SIDEBAR_COOKIE)?.value === "collapsed"}
      user={{
        displayName,
        email: user.email ?? null,
        initials: initialsFor(displayName),
        avatarUrl: typeof user.user_metadata?.avatar_url === "string" ? user.user_metadata.avatar_url : undefined,
      }}
      streak={{ current: stats?.current_streak ?? 0, longest: stats?.longest_streak ?? 0 }}
      activeBookId={lastRead?.book_id ?? null}
      categories={categories ?? []}
    >
      {children}
    </ShellFrame>
  );
}
