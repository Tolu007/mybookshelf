import { format } from "date-fns";
import { HardDrive, PenTool } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { loadPreferences } from "@/lib/preferences-server";
import { garamond, literata } from "@/lib/reader-fonts";
import { PageHeader } from "@/components/page-header";
import { SettingsForm } from "@/components/settings/settings-form";
import { SignOutButton } from "@/components/settings/sign-out-button";
import { DataSection } from "@/components/settings/data-section";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [preferences, { count: volumes }, { count: entries }, { data: stats }] = await Promise.all([
    loadPreferences(supabase, user.id),
    supabase.from("books").select("id", { count: "exact", head: true }),
    supabase.from("annotations").select("id", { count: "exact", head: true }).in("type", ["note", "highlight"]),
    supabase.from("user_stats").select("current_streak, longest_streak").eq("user_id", user.id).maybeSingle(),
  ]);

  const fullName = typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : null;
  const rows = [
    { label: "Volumes", value: `${volumes ?? 0}` },
    { label: "Journal entries", value: `${entries ?? 0}` },
    { label: "Current streak", value: `${stats?.current_streak ?? 0} days`, accent: true },
    { label: "Longest streak", value: `${stats?.longest_streak ?? 0} days` },
    { label: "Reader since", value: format(new Date(user.created_at), "MMM yyyy") },
  ];

  const profile = (
    <section aria-labelledby="profile-heading" className="surface space-y-4 p-5">
      <div className="flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-lg border border-border bg-secondary text-amber"><PenTool className="size-5" aria-hidden="true" /></span>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold tracking-[0.08em] text-amber uppercase">Ex libris</p>
          <h2 id="profile-heading" className="truncate font-heading text-lg leading-6 font-semibold">{fullName ?? "Your library"}</h2>
          {user.email && <p className="truncate text-xs text-muted-foreground">{user.email}</p>}
        </div>
      </div>
      <dl className="divide-y divide-border border-y border-border text-xs">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3 py-2">
            <dt className="text-muted-foreground">{row.label}</dt>
            <dd className={row.accent ? "font-semibold text-amber tabular-nums" : "font-semibold tabular-nums"}>{row.value}</dd>
          </div>
        ))}
      </dl>
      <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
        <HardDrive className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" /> Your books are stored in the &ldquo;Shelf Library&rdquo; folder of the Google Drive you signed in with.
      </p>
      <SignOutButton />
    </section>
  );

  return (
    <div className={`page-shell space-y-6 ${garamond.variable} ${literata.variable}`}>
      <PageHeader
        eyebrow={<><span>System &amp; curation</span><span className="text-muted-foreground" aria-hidden="true">•</span><span className="text-muted-foreground">Shelf configuration</span></>}
        title="Settings & reading environment"
        description="Tune how books are typeset, how Shelf looks, and the goals that keep you reading."
      />
      <SettingsForm initial={preferences} profile={profile} extra={<DataSection />} />
    </div>
  );
}
