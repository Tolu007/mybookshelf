import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { StatTile } from "@/components/stats/stat-tile";
import { StreakHeatmap } from "@/components/stats/streak-heatmap";
import { ReadingBarChart } from "@/components/stats/reading-bar-chart";
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
    <div className="mx-auto max-w-6xl space-y-10 px-6 py-8">
      <div>
        <h1 className="font-heading text-2xl">{year} reading stats</h1>
        <p className="text-muted-foreground">
          Resets every new year — your streaks keep going regardless.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Current streak" value={`${stats?.current_streak ?? 0}d`} />
        <StatTile label="Longest streak" value={`${stats?.longest_streak ?? 0}d`} />
        <StatTile label="Books finished" value={`${booksFinishedThisYear ?? 0}`} sublabel={`in ${year}`} />
        <StatTile label="Time read" value={formatMinutes(yearMinutes)} sublabel={`in ${year}`} />
        <StatTile label="This month" value={formatMinutes(monthMinutes)} />
        <StatTile label="Today" value={formatMinutes(todayMinutes)} />
      </div>

      <section className="space-y-3">
        <h2 className="font-heading text-lg">{year} streak calendar</h2>
        <div className="overflow-x-auto rounded-xl border border-border bg-card p-5">
          <StreakHeatmap dailyMinutes={dailyMinutes} year={year} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-lg">Reading time by month</h2>
        <div className="rounded-xl border border-border bg-card p-5">
          <ReadingBarChart dailyMinutes={dailyMinutes} year={year} />
        </div>
      </section>
    </div>
  );
}
