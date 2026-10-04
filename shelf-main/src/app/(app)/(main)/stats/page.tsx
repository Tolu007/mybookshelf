import { format, subDays } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { StatTile } from "@/components/stats/stat-tile";
import { StreakHeatmap } from "@/components/stats/streak-heatmap";
import { ReadingBarChart } from "@/components/stats/reading-bar-chart";
import {
  buildDailyMinutesMap,
  formatMinutes,
  monthStartIso,
  sumMinutes,
  weekStartIso,
} from "@/lib/stats-aggregate";

export default async function StatsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: stats } = await supabase
    .from("user_stats")
    .select("current_streak, longest_streak, books_finished")
    .eq("user_id", user.id)
    .single();

  const since = format(subDays(new Date(), 83), "yyyy-MM-dd");
  const { data: sessions } = await supabase
    .from("reading_sessions")
    .select("local_date, duration_seconds")
    .gte("local_date", since);

  const rows = sessions ?? [];
  const dailyMinutes = buildDailyMinutesMap(rows);
  const today = format(new Date(), "yyyy-MM-dd");

  const todayMinutes = sumMinutes(rows.filter((row) => row.local_date === today));
  const weekMinutes = sumMinutes(rows, weekStartIso());
  const monthMinutes = sumMinutes(rows, monthStartIso());

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-6 py-8">
      <div>
        <h1 className="font-heading text-2xl">Your reading stats</h1>
        <p className="text-muted-foreground">A look at your reading habit over time.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Current streak" value={`${stats?.current_streak ?? 0}d`} />
        <StatTile label="Longest streak" value={`${stats?.longest_streak ?? 0}d`} />
        <StatTile label="Books finished" value={`${stats?.books_finished ?? 0}`} />
        <StatTile label="Today" value={formatMinutes(todayMinutes)} />
        <StatTile label="This week" value={formatMinutes(weekMinutes)} />
        <StatTile label="This month" value={formatMinutes(monthMinutes)} />
      </div>

      <section className="space-y-3">
        <h2 className="font-heading text-lg">Streak calendar</h2>
        <div className="rounded-xl border border-border bg-card p-5">
          <StreakHeatmap dailyMinutes={dailyMinutes} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-lg">Last 30 days</h2>
        <div className="rounded-xl border border-border bg-card p-5">
          <ReadingBarChart dailyMinutes={dailyMinutes} />
        </div>
      </section>
    </div>
  );
}
