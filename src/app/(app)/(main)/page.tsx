import Link from "next/link";
import { format, formatDistanceToNowStrict, subDays } from "date-fns";
import { BookOpen, Clock3 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AddBookDialog } from "@/components/add-book-dialog";
import { PageHeader } from "@/components/page-header";
import { QuoteCard } from "@/components/library/quote-card";
import { ReadingCard } from "@/components/library/reading-card";
import { TimeGreeting } from "@/components/library/time-greeting";
import { LibraryFilters } from "@/components/library/library-filters";
import { LibraryShelves } from "@/components/library/library-shelves";
import { quoteIndexForDay } from "@/lib/quotes";
import {
  filterBooks,
  filterByFormat,
  groupIntoShelves,
  sortBooks,
  type LibraryParams,
  type ShelfBook,
} from "@/lib/library";

const IN_FLIGHT_LIMIT = 3;

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<LibraryParams>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const since = format(subDays(new Date(), 29), "yyyy-MM-dd");
  const [{ data: categories }, { data: bookRows }, { data: progressRows }, { data: recentSessions }] = await Promise.all([
    supabase.from("categories").select("id, name").order("name"),
    supabase.from("books").select("id, title, author, cover_url, format, category_id, want_to_read, is_favorite, finished_at, added_at"),
    supabase.from("reading_progress").select("book_id, percent, location, updated_at"),
    supabase.from("reading_sessions").select("duration_seconds").gte("local_date", since),
  ]);

  const progressByBook = new Map((progressRows ?? []).map((row) => [row.book_id, row]));
  const books: ShelfBook[] = (bookRows ?? []).map((book) => {
    const progress = progressByBook.get(book.id);
    return {
      ...book,
      percent: progress ? Number(progress.percent) : null,
      last_read_at: progress?.updated_at ?? null,
    };
  });

  // Books opened but not finished, most recently read first.
  const inFlight = books
    .filter((book) => !book.finished_at && book.last_read_at)
    .sort((a, b) => (b.last_read_at ?? "").localeCompare(a.last_read_at ?? ""));
  const featured = inFlight.slice(0, IN_FLIGHT_LIMIT);

  const { data: annotationRows } = featured.length
    ? await supabase.from("annotations").select("book_id, type").in("book_id", featured.map((book) => book.id))
    : { data: [] };
  const countsFor = (bookId: string, type: string) =>
    (annotationRows ?? []).filter((row) => row.book_id === bookId && row.type === type).length;

  const avgMinutes = Math.round((recentSessions ?? []).reduce((sum, row) => sum + row.duration_seconds, 0) / 60 / 30);

  const categoryList = categories ?? [];
  const categoryName = (id: string | null) => categoryList.find((category) => category.id === id)?.name ?? null;

  // Counts for the format pills ignore the format filter itself; category
  // tabs ignore the category filter so you can see what's on other shelves.
  const matching = filterBooks(books, params);
  const visible = sortBooks(filterByFormat(matching, params.format), params.sort);
  const tabSource = filterByFormat(filterBooks(books, { ...params, category: undefined }), params.format);
  const tabs = groupIntoShelves(tabSource, categoryList).map((shelf) => ({ id: shelf.id, name: shelf.name, count: shelf.books.length }));
  const shelves = groupIntoShelves(visible, categoryList).filter((shelf) => !params.category || shelf.id === params.category);

  const filtering = Boolean(params.q || params.shelf || params.category || params.format);
  const fullName = typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : null;
  const firstName = (fullName ?? user.email?.split("@")[0] ?? "reader").split(" ")[0];

  return (
    <div className="page-shell space-y-8">
      <PageHeader
        eyebrow={<><span>Ex libris {firstName}</span><span className="text-muted-foreground" aria-hidden="true">•</span><span className="text-muted-foreground">{books.length} {books.length === 1 ? "volume" : "volumes"}</span></>}
        title={
          params.q ? (
            <>Results for &ldquo;{params.q}&rdquo;</>
          ) : (
            <>
              <TimeGreeting />, {firstName}.{" "}
              <span className="font-normal text-muted-foreground italic lg:inline">
                {inFlight.length === 0
                  ? "Your shelves are ready."
                  : `You have ${inFlight.length} ${inFlight.length === 1 ? "book" : "books"} currently in flight.`}
              </span>
            </>
          )
        }
        action={
          books.length > 0 && (
            <LibraryFilters
              params={params}
              formatCounts={{
                all: matching.length,
                epub: matching.filter((book) => book.format === "epub").length,
                pdf: matching.filter((book) => book.format === "pdf").length,
              }}
            />
          )
        }
      />

      {!filtering && <QuoteCard initialIndex={quoteIndexForDay()} />}

      {!filtering && featured.length > 0 && (
        <section aria-labelledby="in-flight-heading" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span className="size-2 rounded-full bg-ribbon" aria-hidden="true" />
              <h2 id="in-flight-heading" className="font-heading text-xl leading-7 font-semibold">Currently reading</h2>
              <span className="tag text-sage">{inFlight.length} in progress</span>
            </div>
            {avgMinutes > 0 && (
              <p className="meta flex items-center gap-1.5"><Clock3 className="size-3.5 text-amber" aria-hidden="true" /> Avg. {avgMinutes} min / day over 30 days</p>
            )}
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {featured.map((book, index) => (
              <ReadingCard
                key={book.id}
                book={book}
                percent={book.percent ?? 0}
                location={progressByBook.get(book.id)?.location ?? null}
                categoryName={categoryName(book.category_id)}
                lastReadLabel={book.last_read_at ? formatDistanceToNowStrict(new Date(book.last_read_at), { addSuffix: true }) : null}
                notes={countsFor(book.id, "note")}
                highlights={countsFor(book.id, "highlight")}
                primary={index === 0}
              />
            ))}
          </div>
        </section>
      )}

      {shelves.length > 0 ? (
        <LibraryShelves shelves={shelves} tabs={tabs} params={params} categories={categoryList} />
      ) : (
        <div className="surface flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
          <span className="mb-2 flex size-14 items-center justify-center rounded-full border border-border bg-secondary text-sage"><BookOpen className="size-6" strokeWidth={1.5} aria-hidden="true" /></span>
          <h2 className="font-heading text-2xl">{params.q ? "No matching books" : filtering ? "A shelf waiting to be filled" : "Every library starts with one book"}</h2>
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
            {params.q
              ? `No books match "${params.q}". Try another title or author.`
              : filtering
                ? "Nothing here matches these filters yet."
                : "Upload a PDF or EPUB you love. Shelf keeps your place, and the thoughts you find along the way."}
          </p>
          <div className="mt-3">
            {filtering ? (
              <Link href="/" className="text-sm font-semibold text-sage hover:underline">Clear filters</Link>
            ) : (
              <AddBookDialog categories={categoryList} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
