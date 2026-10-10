import { createClient } from "@/lib/supabase/server";
import { Input } from "@/components/ui/input";
import { AddBookDialog } from "@/components/add-book-dialog";
import { BookCard } from "@/components/book-card";
import { LibraryCollection } from "@/components/library-collection";
import { ReadingHero } from "@/components/reading-hero";
import { PageHeader } from "@/components/page-header";
import { BookOpen, Search, ArrowRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const EMPTY_UUID = "00000000-0000-0000-0000-000000000000";

const SHELF_TITLES: Record<string, string> = {
  reading: "Reading",
  want_to_read: "Want to Read",
  finished: "Finished",
  favorites: "Favorites",
};

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; shelf?: string; q?: string }>;
}) {
  const { category: categoryFilter, shelf: shelfFilter, q: query } = await searchParams;
  const supabase = await createClient();

  const { data: categories } = await supabase
    .from("categories")
    .select("id, name")
    .order("name");

  let booksQuery = supabase
    .from("books")
    .select(
      "id, title, author, cover_url, format, category_id, want_to_read, is_favorite, finished_at"
    )
    .order("added_at", { ascending: false });

  if (categoryFilter) {
    booksQuery = booksQuery.eq("category_id", categoryFilter);
  }
  if (query) {
    const safeQuery = query.replace(/[,()]/g, "");
    booksQuery = booksQuery.or(`title.ilike.%${safeQuery}%,author.ilike.%${safeQuery}%`);
  }

  if (shelfFilter === "want_to_read") {
    booksQuery = booksQuery.eq("want_to_read", true);
  } else if (shelfFilter === "favorites") {
    booksQuery = booksQuery.eq("is_favorite", true);
  } else if (shelfFilter === "finished") {
    booksQuery = booksQuery.not("finished_at", "is", null);
  } else if (shelfFilter === "reading") {
    const { data: progressRows } = await supabase.from("reading_progress").select("book_id");
    const ids = (progressRows ?? []).map((row) => row.book_id);
    booksQuery = booksQuery.is("finished_at", null).in("id", ids.length ? ids : [EMPTY_UUID]);
  }

  const { data: books } = await booksQuery;

  const showContinueReading = !categoryFilter && !shelfFilter && !query;
  let continueReading: {
    percent: number;
    book: {
      id: string;
      title: string;
      author: string | null;
      cover_url: string | null;
      format: string;
      want_to_read: boolean;
      is_favorite: boolean;
      category_id: string | null;
    };
  }[] = [];

  if (showContinueReading) {
    type ProgressRow = {
      percent: number;
      updated_at: string;
      book: {
        id: string;
        title: string;
        author: string | null;
        cover_url: string | null;
        format: string;
        want_to_read: boolean;
        is_favorite: boolean;
        category_id: string | null;
        finished_at: string | null;
      } | null;
    };

    const { data: progressRows } = await supabase
      .from("reading_progress")
      .select(
        "percent, updated_at, book:books(id, title, author, cover_url, format, want_to_read, is_favorite, category_id, finished_at)"
      )
      .order("updated_at", { ascending: false })
      .limit(10);

    continueReading = ((progressRows ?? []) as unknown as ProgressRow[])
      .filter(
        (row): row is ProgressRow & { book: NonNullable<ProgressRow["book"]> } =>
          Boolean(row.book) && !row.book!.finished_at
      )
      .slice(0, 6);
  }

  const pageTitle = query
    ? `Results for "${query}"`
    : categoryFilter
      ? (categories?.find((c) => c.id === categoryFilter)?.name ?? "My library")
      : shelfFilter
        ? (SHELF_TITLES[shelfFilter] ?? "Library")
        : "My library";

  return (
    <div className="page-shell space-y-8">
      <PageHeader eyebrow="Your reading space" title={pageTitle} description={query ? "A familiar favorite or a new perspective. Find it here." : "Good books, collected. A world of ideas, always within reach."} action={<AddBookDialog categories={categories ?? []} />} />
      <form action="/" method="get" role="search" className="relative max-w-lg">
        {shelfFilter && <input type="hidden" name="shelf" value={shelfFilter} />}
        {categoryFilter && <input type="hidden" name="category" value={categoryFilter} />}
        <label htmlFor="library-search" className="sr-only">Search by title or author</label>
        <Search className="pointer-events-none absolute top-3 left-3.5 size-4 text-muted-foreground" aria-hidden="true" />
        <Input id="library-search" type="search" name="q" placeholder="Find your next chapter…" defaultValue={query ?? ""} className="h-11 bg-card pr-12 pl-10" />
        <button type="submit" aria-label="Search library" className="absolute top-1 right-1 flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"><ArrowRight className="size-4" /></button>
      </form>
      {showContinueReading && <ReadingHero current={continueReading[0]} />}
      {continueReading.length > 1 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between"><h2 className="font-heading text-xl tracking-tight">On your nightstand</h2><Link href="/?shelf=reading" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">See all <ArrowRight className="size-3" /></Link></div>
          <div className="grid auto-cols-[160px] grid-flow-col gap-5 overflow-x-auto pb-3 sm:auto-cols-[180px]">
            {continueReading.slice(1).map((row) => (
              <BookCard
                key={row.book.id}
                book={row.book}
                categories={categories ?? []}
                progressPercent={row.percent}
              />
            ))}
          </div>
        </section>
      )}

      <section aria-label="Book collection" className="space-y-6">
        <nav aria-label="Filter books by shelf" className="flex gap-5 overflow-x-auto border-b border-border">
          {[{ key: "", label: "All books" }, { key: "reading", label: "Reading" }, { key: "want_to_read", label: "Want to read" }, { key: "finished", label: "Finished" }, { key: "favorites", label: "Favorites" }].map((item) => (
            <Link key={item.key} href={{ pathname: "/", query: { ...(item.key ? { shelf: item.key } : {}), ...(categoryFilter ? { category: categoryFilter } : {}), ...(query ? { q: query } : {}) } }} aria-current={(shelfFilter ?? "") === item.key ? "page" : undefined} className={cn("shrink-0 border-b-2 px-0.5 pb-3 text-xs transition-colors", (shelfFilter ?? "") === item.key ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>{item.label}</Link>
          ))}
        </nav>

        {!books?.length ? (
          <div className="surface flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <span className="mb-2 flex size-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground"><BookOpen className="size-6" strokeWidth={1.5} aria-hidden="true" /></span>
            <h2 className="font-heading text-2xl">{query ? "No matching chapters" : shelfFilter || categoryFilter ? "A shelf waiting to be filled" : "Every library starts with one book"}</h2>
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">{query ? `No books match "${query}". Try another title or author.` : shelfFilter || categoryFilter ? "Books you add to this collection will find their home here." : "Bring a PDF or EPUB you love. We'll keep your place, and the thoughts you find along the way."}</p>
            <div className="mt-3">{query || shelfFilter || categoryFilter ? <Link href="/" className="text-sm font-medium text-primary hover:underline">Back to all books</Link> : <AddBookDialog categories={categories ?? []} />}</div>
          </div>
        ) : (
          <LibraryCollection books={books} categories={categories ?? []} />
        )}
      </section>
    </div>
  );
}
