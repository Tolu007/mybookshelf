import Link from "next/link";
import { differenceInCalendarDays, format, getDaysInYear, parseISO, startOfMonth, startOfWeek, subMonths } from "date-fns";
import { BookCheck, CalendarDays, CalendarRange, Flame, Hourglass, Medal, TrendingDown, TrendingUp, Timer } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { loadPreferences } from "@/lib/preferences-server";
import { loadAverageWpm } from "@/lib/reading-speed-server";
import { StatTile } from "@/components/stats/stat-tile";
import { StreakHeatmap } from "@/components/stats/streak-heatmap";
import { ReadingBarChart, YearlyBarChart } from "@/components/stats/reading-bar-chart";
import { ProgressRibbon } from "@/components/library/reading-card";
import { PageHeader } from "@/components/page-header";
import { FinishedBooksTable, type FinishedBookRow } from "@/components/stats/finished-books-table";
import { cn } from "@/lib/utils";
import { fetchAll } from "@/lib/supabase/fetch-all";
import {
  buildDailyMinutesMap,
  buildMonthlyTotals,
  buildYearlyTotals,
  countActiveDays,
  formatMinutes,
  longestStreakIn,
  peakWeekday,
  sumMinutes,
  yearStartIso,
} from "@/lib/stats-aggregate";

const LONG_SESSION_SECONDS = 60 * 60;

function hoursAndMinutes(minutes: number) {
  const total = Math.round(minutes);
  return `${Math.floor(total / 60)}h ${total % 60}m`;
}

function days(count: number) {
  return `${count} ${count === 1 ? "day" : "days"}`;
}

function Trend({ up, children }: { up: boolean; children: React.ReactNode }) {
  return (
    <p className={cn("flex items-center gap-1", up ? "text-sage" : "text-amber")}>
      {up ? <TrendingUp className="size-3.5" aria-hidden="true" /> : <TrendingDown className="size-3.5" aria-hidden="true" />}
      {children}
    </p>
  );
}

export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const now = new Date();
  const currentYear = now.getFullYear();
  const today = format(now, "yyyy-MM-dd");

  // Years to offer: from your first recorded reading or finished book.
  const [{ data: firstSession }, { data: firstFinished }] = await Promise.all([
    supabase.from("reading_sessions").select("local_date").order("local_date").limit(1).maybeSingle(),
    supabase.from("books").select("finished_at").not("finished_at", "is", null).order("finished_at").limit(1).maybeSingle(),
  ]);
  const firstYear = Math.min(
    currentYear,
    firstSession ? Number(firstSession.local_date.slice(0, 4)) : currentYear,
    firstFinished ? new Date(firstFinished.finished_at).getFullYear() : currentYear
  );
  const years = Array.from({ length: currentYear - firstYear + 1 }, (_, index) => currentYear - index);

  const allTime = params.year === "all";
  const year = allTime ? currentYear : years.includes(Number(params.year)) ? Number(params.year) : currentYear;
  const isCurrentYear = !allTime && year === currentYear;

  const yearStart = yearStartIso(year);
  const yearEnd = `${year}-12-31`;
  const monthStart = format(startOfMonth(now), "yyyy-MM-dd");
  const lastMonthStart = format(startOfMonth(subMonths(now, 1)), "yyyy-MM-dd");
  // This month's comparison may reach into the previous year (in January).
  const sessionsFrom = allTime ? null : isCurrentYear && lastMonthStart < yearStart ? lastMonthStart : yearStart;

  const sessionsPage = (from: number, to: number) => {
    let query = supabase.from("reading_sessions").select("id, local_date, duration_seconds").order("id");
    if (sessionsFrom) query = query.gte("local_date", sessionsFrom).lte("local_date", yearEnd);
    return query.range(from, to);
  };
  let finishedQuery = supabase
    .from("books")
    .select("id, title, author, cover_url, finished_at, category_id")
    .not("finished_at", "is", null)
    .order("finished_at", { ascending: false });
  if (!allTime) {
    finishedQuery = finishedQuery
      .gte("finished_at", new Date(year, 0, 1).toISOString())
      .lt("finished_at", new Date(year + 1, 0, 1).toISOString());
  }

  const [{ data: stats }, { data: finishedBooks }, { data: sessions }, preferences, averageWpm, { data: categories }] = await Promise.all([
    supabase.from("user_stats").select("current_streak, longest_streak").eq("user_id", user.id).maybeSingle(),
    finishedQuery,
    fetchAll(sessionsPage),
    loadPreferences(supabase, user.id),
    loadAverageWpm(supabase, allTime ? {} : { from: yearStart, to: yearEnd }),
    supabase.from("categories").select("id, name"),
  ]);

  // Time and sessions per finished book, across all of its reading.
  // IDs go in the URL, so ask in batches to stay well under length limits.
  const finishedIds = (finishedBooks ?? []).map((book) => book.id);
  const idBatches = Array.from({ length: Math.ceil(finishedIds.length / 100) }, (_, index) => finishedIds.slice(index * 100, index * 100 + 100));
  const bookSessions = (
    await Promise.all(
      idBatches.map((ids) =>
        fetchAll<{ book_id: string; duration_seconds: number }>((from, to) =>
          supabase.from("reading_sessions").select("id, book_id, duration_seconds").in("book_id", ids).order("id").range(from, to)
        )
      )
    )
  ).flatMap((result) => result.data);
  const finishedRows: FinishedBookRow[] = (finishedBooks ?? []).map((book) => {
    const own = bookSessions.filter((session) => session.book_id === book.id);
    return {
      id: book.id,
      title: book.title,
      author: book.author,
      cover_url: book.cover_url,
      finished_at: book.finished_at,
      shelf: (categories ?? []).find((category) => category.id === book.category_id)?.name ?? null,
      minutes: own.reduce((sum, session) => sum + session.duration_seconds, 0) / 60,
      sessions: own.length,
    };
  });

  const allRows = sessions ?? [];
  const periodRows = allTime ? allRows : allRows.filter((row) => row.local_date >= yearStart);
  const dailyMinutes = buildDailyMinutesMap(periodRows);
  const periodMinutes = sumMinutes(periodRows);
  const finished = finishedRows.length;
  const streak = stats?.current_streak ?? 0;
  const longestEver = stats?.longest_streak ?? 0;
  const longestInPeriod = allTime ? longestEver : longestStreakIn(dailyMinutes);
  // Days the period has had so far: the whole year once it's over.
  const periodDays = allTime
    ? Math.max(1, differenceInCalendarDays(now, parseISO(allRows.map((row) => row.local_date).sort()[0] ?? today)) + 1)
    : isCurrentYear
      ? differenceInCalendarDays(now, new Date(year, 0, 1)) + 1
      : getDaysInYear(new Date(year, 0, 1));
  const activeDays = countActiveDays(dailyMinutes, allTime ? "0000-00-00" : yearStart, allTime ? today : isCurrentYear ? today : yearEnd);
  const speedNote = averageWpm ? <p className="text-sage">Average speed: {averageWpm} words / min</p> : null;

  let tiles: React.ReactNode;
  if (isCurrentYear) {
    const monthMinutes = sumMinutes(allRows, monthStart);
    const lastMonthMinutes = sumMinutes(allRows.filter((row) => row.local_date < monthStart), lastMonthStart);
    const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
    const weekMinutes = sumMinutes(allRows, weekStart);
    const todayMinutes = sumMinutes(allRows.filter((row) => row.local_date === today));
    const daysThisWeek = differenceInCalendarDays(now, startOfWeek(now, { weekStartsOn: 1 })) + 1;
    const yearlyGoal = preferences.goals.yearlyBooks;
    const dailyGoal = preferences.goals.dailyMinutes;
    const pace = yearlyGoal ? Math.round((finished - (yearlyGoal * periodDays) / getDaysInYear(now)) * 10) / 10 : 0;
    const monthChange = lastMonthMinutes > 0 ? Math.round(((monthMinutes - lastMonthMinutes) / lastMonthMinutes) * 100) : null;

    tiles = (
      <>
        <StatTile label={`Books finished (${year})`} icon={BookCheck} value={`${finished}`} unit={yearlyGoal ? `/ ${yearlyGoal} goal` : undefined}>
          {yearlyGoal ? (
            <>
              <ProgressRibbon value={(finished / yearlyGoal) * 100} label="Progress toward your yearly goal" />
              <Trend up={pace >= 0}>{pace === 0 ? "Right on pace" : `${Math.abs(pace)} ${pace > 0 ? "ahead of" : "behind"} pace`}</Trend>
            </>
          ) : (
            <Link href="/settings" className="font-semibold text-sage hover:underline">Set a yearly goal</Link>
          )}
        </StatTile>
        <StatTile label="Time invested" icon={Hourglass} value={hoursAndMinutes(periodMinutes)}>
          <p>{Math.round(periodMinutes / periodDays)} min daily mean this year</p>
          {speedNote}
        </StatTile>
        <StatTile label={`This month (${format(now, "MMMM")})`} icon={CalendarDays} value={formatMinutes(monthMinutes)}>
          {monthChange === null ? (
            <p>Nothing logged last month to compare.</p>
          ) : (
            <Trend up={monthChange >= 0}>{monthChange >= 0 ? "+" : ""}{monthChange}% vs {format(subMonths(now, 1), "MMMM")}</Trend>
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
          <p>Personal record: {days(longestEver)}</p>
          <p className="text-amber">{streak > 0 ? "Read today to keep it going." : "Read today to start a new streak."}</p>
        </StatTile>
      </>
    );
  } else if (!allTime) {
    const months = buildMonthlyTotals(dailyMinutes, year);
    const bestMonth = months.reduce((best, month) => (month.minutes > best.minutes ? month : best), months[0]);
    tiles = (
      <>
        <StatTile label={`Books finished (${year})`} icon={BookCheck} value={`${finished}`}>
          <p>Marked finished during {year}</p>
        </StatTile>
        <StatTile label="Time invested" icon={Hourglass} value={hoursAndMinutes(periodMinutes)}>
          <p>{Math.round(periodMinutes / periodDays)} min daily mean</p>
          {speedNote}
        </StatTile>
        <StatTile label="Best month" icon={Medal} value={bestMonth.minutes > 0 ? format(new Date(year, bestMonth.month, 1), "MMMM") : "—"}>
          <p>{bestMonth.minutes > 0 ? `${formatMinutes(bestMonth.minutes)} of reading` : "No reading recorded"}</p>
        </StatTile>
        <StatTile label="Active days" icon={CalendarDays} value={`${activeDays}`} unit={`/ ${periodDays}`}>
          <p>{Math.round((activeDays / periodDays) * 100)}% of the year</p>
        </StatTile>
        <StatTile label={`Longest streak (${year})`} icon={Flame} value={`${longestInPeriod}`} unit={longestInPeriod === 1 ? "day" : "days"} accent>
          <p>Personal record: {days(longestEver)}</p>
        </StatTile>
      </>
    );
  } else {
    const yearly = buildYearlyTotals(dailyMinutes, currentYear);
    const bestYear = yearly.reduce((best, entry) => (entry.minutes > best.minutes ? entry : best), yearly[0]);
    const firstDay = allRows.map((row) => row.local_date).sort()[0];
    tiles = (
      <>
        <StatTile label="Books finished" icon={BookCheck} value={`${finished}`}>
          <p>Across your whole library</p>
        </StatTile>
        <StatTile label="Time invested" icon={Hourglass} value={hoursAndMinutes(periodMinutes)}>
          {firstDay && <p>Since {format(parseISO(firstDay), "MMM d, yyyy")}</p>}
          {speedNote}
        </StatTile>
        <StatTile label="Best year" icon={Medal} value={bestYear.minutes > 0 ? String(bestYear.year) : "—"}>
          <p>{bestYear.minutes > 0 ? `${formatMinutes(bestYear.minutes)} of reading` : "No reading recorded"}</p>
        </StatTile>
        <StatTile label="Active days" icon={CalendarDays} value={`${activeDays}`}>
          <p>{Math.round((activeDays / periodDays) * 100)}% of days since you started</p>
        </StatTile>
        <StatTile label="Longest streak" icon={Flame} value={`${longestEver}`} unit={longestEver === 1 ? "day" : "days"} accent>
          <p>Current streak: {days(streak)}</p>
        </StatTile>
      </>
    );
  }

  const peak = peakWeekday(dailyMinutes);
  const longSessions = periodRows.filter((row) => row.duration_seconds >= LONG_SESSION_SECONDS).length;
  const periodName = allTime ? "all time" : String(year);

  return (
    <div className="page-shell space-y-8">
      <PageHeader
        eyebrow={<><span>Reading ledger</span><span className="text-muted-foreground" aria-hidden="true">•</span><span className="text-muted-foreground capitalize">{periodName}</span></>}
        title="Reading cadence"
        description={allTime ? "Every hour, book and streak since you started using Shelf." : isCurrentYear ? "Time spent, books finished, and the rhythm of your reading year." : `A look back at your reading in ${year}.`}
        action={
          <nav aria-label="Choose a year" className="flex max-w-full gap-1 self-start overflow-x-auto rounded-xl border border-border bg-card p-1 lg:self-auto">
            {[...years.map((value) => ({ key: String(value), label: String(value), href: value === currentYear ? "/stats" : `/stats?year=${value}`, active: !allTime && value === year })), { key: "all", label: "All time", href: "/stats?year=all", active: allTime }].map((option) => (
              <Link
                key={option.key}
                href={option.href}
                aria-current={option.active ? "page" : undefined}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold tabular-nums transition-colors",
                  option.active ? "border-primary/30 bg-primary text-primary-foreground" : "border-transparent text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                {option.key === "all" && <CalendarRange className="size-3.5" aria-hidden="true" />}
                {option.label}
              </Link>
            ))}
          </nav>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">{tiles}</div>

      {allTime ? (
        <section aria-labelledby="yearly-heading" className="surface overflow-hidden">
          <div className="px-5 pt-5 sm:px-6">
            <h2 id="yearly-heading" className="font-heading text-xl leading-7 font-semibold">Year by year</h2>
            <p className="mt-1 text-[13px] text-muted-foreground">Hours of reading in each year; your best year in amber.</p>
          </div>
          <div className="overflow-x-auto px-5 py-5 sm:px-6">
            <YearlyBarChart dailyMinutes={dailyMinutes} untilYear={currentYear} />
          </div>
        </section>
      ) : (
        <>
          <section aria-labelledby="activity-heading" className="surface overflow-hidden">
            <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 sm:px-6">
              <div>
                <h2 id="activity-heading" className="flex items-center gap-2 font-heading text-xl leading-7 font-semibold">Reading activity in {year} <span className="tag">12 months</span></h2>
                <p className="mt-1 text-[13px] text-muted-foreground">Each square is a day; deeper colour means more time with a book.</p>
              </div>
            </div>
            <div className="overflow-x-auto px-5 py-5 sm:px-6">
              <StreakHeatmap dailyMinutes={dailyMinutes} year={year} />
            </div>
            <dl className="grid grid-cols-2 gap-px border-t border-border bg-border md:grid-cols-4">
              {[
                { label: "Active days", value: `${activeDays} / ${periodDays}` },
                { label: "Peak reading day", value: peak ? `${peak.label} (${formatMinutes(peak.averageMinutes)} avg)` : "Not yet", accent: true },
                { label: `Longest streak in ${year}`, value: days(longestInPeriod) },
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
        </>
      )}

      <FinishedBooksTable books={finishedRows} periodName={periodName} />
    </div>
  );
}
