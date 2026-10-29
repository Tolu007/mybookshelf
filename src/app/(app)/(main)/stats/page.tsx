import Link from "next/link";
import { differenceInCalendarDays, format, getDaysInYear, startOfMonth, startOfWeek, subMonths } from "date-fns";
import { BookCheck, CalendarDays, Flame, Hourglass, TrendingDown, TrendingUp, Timer } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { loadPreferences } from "@/lib/preferences-server";
import { StatTile } from "@/components/stats/stat-tile";
import { StreakHeatmap } from "@/components/stats/streak-heatmap";
import { ReadingBarChart } from "@/components/stats/reading-bar-chart";
import { ProgressRibbon } from "@/components/library/reading-card";
import { PageHeader } from "@/components/page-header";
import {
  buildDailyMinutesMap,
  countActiveDays,
  formatMinutes,
  peakWeekday,
  sumMinutes,
  yearStartIso,
} from "@/lib/stats-aggregate";

const LONG_SESSION_SECONDS = 60 * 60;

function hoursAndMinutes(minutes: number) {
  const total = Math.round(minutes);
  return { hours: Math.floor(total / 60), minutes: total % 60 };
}

export default async function StatsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const now = new Date();
  const year = now.getFullYear();
  const today = format(now, "yyyy-MM-dd");
  const monthStart = format(startOfMonth(now), "yyyy-MM-dd");
  const lastMonthStart = format(startOfMonth(subMonths(now, 1)), "yyyy-MM-dd");
  const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
  const yearStart = yearStartIso(year);
  // Last month may fall in the previous year (in January).
  const fetchFrom = lastMonthStart < yearStart ? lastMonthStart : yearStart;

  const [{ data: stats }, { count: booksFinishedThisYear }, { data: sessions }, preferences] = await Promise.all([
    supabase.from("user_stats").select("current_streak, longest_streak").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("books")
      .select("id", { count: "exact", head: true })
      .gte("finished_at", new Date(year, 0, 1).toISOString())
      .lt("finished_at", new Date(year + 1, 0, 1).toISOString()),
    supabase.from("reading_sessions").select("local_date, duration_seconds").gte("local_date", fetchFrom),
    loadPreferences(supabase, user.id),
  ]);

  const allRows = sessions ?? [];
  const yearRows = allRows.filter((row) => row.local_date >= yearStart);
  const dailyMinutes = buildDailyMinutesMap(yearRows);

  const yearMinutes = sumMinutes(yearRows);
  const monthMinutes = sumMinutes(allRows, monthStart);
  const lastMonthMinutes = sumMinutes(allRows.filter((row) => row.local_date < monthStart), lastMonthStart);
  const weekMinutes = sumMinutes(allRows, weekStart);
  const todayMinutes = sumMinutes(allRows.filter((row) => row.local_date === today));
  const daysElapsed = differenceInCalendarDays(now, new Date(year, 0, 1)) + 1;
  const daysThisWeek = differenceInCalendarDays(now, startOfWeek(now, { weekStartsOn: 1 })) + 1;

  const finished = booksFinishedThisYear ?? 0;
  const yearlyGoal = preferences.goals.yearlyBooks;
  const dailyGoal = preferences.goals.dailyMinutes;
  const expectedByNow = yearlyGoal ? (yearlyGoal * daysElapsed) / getDaysInYear(now) : 0;
  const pace = yearlyGoal ? Math.round((finished - expectedByNow) * 10) / 10 : 0;
  const monthChange = lastMonthMinutes > 0 ? Math.round(((monthMinutes - lastMonthMinutes) / lastMonthMinutes) * 100) : null;

  const activeDays = countActiveDays(dailyMinutes, yearStart, today);
  const peak = peakWeekday(dailyMinutes);
  const longSessions = yearRows.filter((row) => row.duration_seconds >= LONG_SESSION_SECONDS).length;
  const yearTime = hoursAndMinutes(yearMinutes);
  const streak = stats?.current_streak ?? 0;
  const longest = stats?.longest_streak ?? 0;

  return (
    <div className="page-shell space-y-8">
      <PageHeader
        eyebrow={<><span>Reading ledger</span><span className="text-muted-foreground" aria-hidden="true">•</span><span className="text-muted-foreground">{year}</span></>}
        title="Reading cadence"
        description="Time spent, books finished, and the rhythm of your reading year."
        action={<span className="flex items-center gap-2 self-start rounded-lg border border-primary/30 bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground lg:self-auto"><CalendarDays className="size-3.5" aria-hidden="true" /> {year}</span>}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        <StatTile label={`Books finished (${year})`} icon={BookCheck} value={`${finished}`} unit={yearlyGoal ? `/ ${yearlyGoal} goal` : undefined}>
          {yearlyGoal ? (
            <>
              <ProgressRibbon value={(finished / yearlyGoal) * 100} label="Progress toward your yearly goal" />
              <p className={pace >= 0 ? "flex items-center gap-1 text-sage" : "flex items-center gap-1 text-amber"}>
                {pace >= 0 ? <TrendingUp className="size-3.5" aria-hidden="true" /> : <TrendingDown className="size-3.5" aria-hidden="true" />}
                {pace === 0 ? "Right on pace" : `${Math.abs(pace)} ${pace > 0 ? "ahead of" : "behind"} pace`}
              </p>
            </>
          ) : (
            <Link href="/settings" className="font-semibold text-sage hover:underline">Set a yearly goal</Link>
          )}
        </StatTile>
        <StatTile label="Time invested" icon={Hourglass} value={`${yearTime.hours}h ${yearTime.minutes}m`}>
          <p>{Math.round(yearMinutes / daysElapsed)} min daily mean this year</p>
        </StatTile>
        <StatTile label={`This month (${format(now, "MMMM")})`} icon={CalendarDays} value={formatMinutes(monthMinutes)}>
          {monthChange === null ? (
            <p>Nothing logged last month to compare.</p>
          ) : (
            <p className={monthChange >= 0 ? "flex items-center gap-1 text-sage" : "flex items-center gap-1 text-amber"}>
              {monthChange >= 0 ? <TrendingUp className="size-3.5" aria-hidden="true" /> : <TrendingDown className="size-3.5" aria-hidden="true" />}
              {monthChange >= 0 ? "+" : ""}{monthChange}% vs {format(subMonths(now, 1), "MMMM")}
            </p>
          )}
        </StatTile>
        <StatTile label="This week" icon={Timer} value={formatMinutes(weekMinutes)}>
          <p>Daily avg: {formatMinutes(weekMinutes / daysThisWeek)}</p>
          {dailyGoal ? (
            <>
              <ProgressRibbon value={(todayMinutes / dailyGoal) * 100} label="Progress toward today's goal" />
              <p>Today: {formatMinutes(todayMinutes)} of {dailyGoal}m goal</p>
            </>
          ) : (
            <p>Today: {formatMinutes(todayMinutes)}</p>
          )}
        </StatTile>
        <StatTile label="Current streak" icon={Flame} value={`${streak}`} unit={streak === 1 ? "day" : "days"} accent>
          <p>Personal record: {longest} {longest === 1 ? "day" : "days"}</p>
          <p className="text-amber">{streak > 0 ? "Read today to keep it going." : "Read today to start a new streak."}</p>
        </StatTile>
      </div>

      <section aria-labelledby="activity-heading" className="surface overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 sm:px-6">
          <div>
            <h2 id="activity-heading" className="flex items-center gap-2 font-heading text-xl leading-7 font-semibold">Annual reading activity <span className="tag">12 months</span></h2>
            <p className="mt-1 text-[13px] text-muted-foreground">Each square is a day; deeper colour means more time with a book.</p>
          </div>
        </div>
        <div className="overflow-x-auto px-5 py-5 sm:px-6">
          <StreakHeatmap dailyMinutes={dailyMinutes} year={year} />
        </div>
        <dl className="grid grid-cols-2 gap-px border-t border-border bg-border md:grid-cols-4">
          {[
            { label: "Active days", value: `${activeDays} / ${daysElapsed}` },
            { label: "Peak reading day", value: peak ? `${peak.label} (${formatMinutes(peak.averageMinutes)} avg)` : "Not yet", accent: true },
            { label: "Longest streak", value: `${longest} ${longest === 1 ? "day" : "days"}` },
            { label: "Long sessions (1h+)", value: `${longSessions}` },
          ].map((item) => (
            <div key={item.label} className="bg-secondary px-5 py-3 sm:px-6 dark:bg-card">
              <dt className="text-[10px] font-medium tracking-[0.06em] text-muted-foreground uppercase">{item.label}</dt>
              <dd className={item.accent ? "mt-1 font-heading text-lg leading-6 text-amber" : "mt-1 font-heading text-lg leading-6"}>{item.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="monthly-heading" className="surface overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 sm:px-6">
          <div>
            <h2 id="monthly-heading" className="font-heading text-xl leading-7 font-semibold">Monthly reading hours</h2>
            <p className="mt-1 text-[13px] text-muted-foreground">Your reading time, month by month.</p>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-[2px] bg-primary" aria-hidden="true" /> Recorded</span>
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-[2px] bg-ribbon" aria-hidden="true" /> Peak month</span>
          </div>
        </div>
        <div className="overflow-x-auto px-5 py-5 sm:px-6">
          <ReadingBarChart dailyMinutes={dailyMinutes} year={year} />
        </div>
      </section>
    </div>
  );
}
