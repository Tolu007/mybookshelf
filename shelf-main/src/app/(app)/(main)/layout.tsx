import { createClient } from "@/lib/supabase/server";
import { AppSidebar } from "@/components/sidebar/app-sidebar";

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
    <div className="flex h-dvh flex-col md:flex-row">
      <AppSidebar
        categories={categories ?? []}
        initials={initialsFor(user)}
        avatarUrl={user.user_metadata?.avatar_url as string | undefined}
      />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
