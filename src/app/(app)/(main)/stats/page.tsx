import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { StatTile } from "@/components/stats/stat-tile";
import { StreakHeatmap } from "@/components/stats/streak-heatmap";
import { ReadingBarChart } from "@/components/stats/reading-bar-chart";
import { PageHeader } from "@/components/page-header";
import { CalendarDays } from "lucide-react";
import {
  buildDailyMinutesMap,
  formatMinutes,
  monthStartIso,
  sumMinutes,
  yearStartIso,
} from "@/lib/stats-aggregate";

export default async function StatsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const year = new Date().getFullYear();

  const { data: stats } = await supabase
    .from("user_stats")
    .select("current_streak, longest_streak")
    .eq("user_id", user.id)
    .single();

  const { count: booksFinishedThisYear } = await supabase
    .from("books")
    .select("id", { count: "exact", head: true })
    .gte("finished_at", new Date(year, 0, 1).toISOString())
    .lt("finished_at", new Date(year + 1, 0, 1).toISOString());

  const { data: sessions } = await supabase
    .from("reading_sessions")
    .select("local_date, duration_seconds")
    .gte("local_date", yearStartIso(year));

  const rows = sessions ?? [];
  const dailyMinutes = buildDailyMinutesMap(rows);
  const today = format(new Date(), "yyyy-MM-dd");

  const todayMinutes = sumMinutes(rows.filter((row) => row.local_date === today));
  const monthMinutes = sumMinutes(rows, monthStartIso());
  const yearMinutes = sumMinutes(rows);

  return (
    <div className="page-shell space-y-8">
      <PageHeader eyebrow="Your reading, reflected" title="One page at a time." description="Small moments add up. Here's a little perspective on your reading year." action={<span className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-xs"><CalendarDays className="size-3.5 text-muted-foreground" aria-hidden="true" /> {year} reading year</span>} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Current streak" value={`${stats?.current_streak ?? 0}d`} />
        <StatTile label="Longest streak" value={`${stats?.longest_streak ?? 0}d`} />
        <StatTile label="Books finished" value={`${booksFinishedThisYear ?? 0}`} sublabel={`in ${year}`} />
        <StatTile label="Time read" value={formatMinutes(yearMinutes)} sublabel={`in ${year}`} />
        <StatTile label="This month" value={formatMinutes(monthMinutes)} />
        <StatTile label="Today" value={formatMinutes(todayMinutes)} />
      </div>

      <section className="surface overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-5"><div><h2 className="font-heading text-xl tracking-tight">Your reading rhythm</h2><p className="mt-1 text-xs text-muted-foreground">Every little square is a day spent with a book.</p></div><span className="eyebrow">{year}</span></div>
        <div className="overflow-x-auto p-6">
          <StreakHeatmap dailyMinutes={dailyMinutes} year={year} />
        </div>
      </section>

      <section className="surface overflow-hidden">
        <div className="border-b border-border px-6 py-5"><h2 className="font-heading text-xl tracking-tight">Time well spent</h2><p className="mt-1 text-xs text-muted-foreground">Your reading time, month by month.</p></div>
        <div className="overflow-x-auto p-6">
          <ReadingBarChart dailyMinutes={dailyMinutes} year={year} />
        </div>
      </section>
      <p className="text-center text-[11px] leading-relaxed text-muted-foreground">A new year brings a fresh page. Your longest streak keeps its place.</p>
    </div>
  );
}
