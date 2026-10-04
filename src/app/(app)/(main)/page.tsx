import { createClient } from "@/lib/supabase/server";
import { Input } from "@/components/ui/input";
import { AddBookDialog } from "@/components/add-book-dialog";
import { BookCard } from "@/components/book-card";

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
        finished_at: string | null;
      } | null;
    };

    const { data: progressRows } = await supabase
      .from("reading_progress")
      .select(
        "percent, updated_at, book:books(id, title, author, cover_url, format, want_to_read, is_favorite, finished_at)"
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
      ? (categories?.find((c) => c.id === categoryFilter)?.name ?? "Library")
      : shelfFilter
        ? (SHELF_TITLES[shelfFilter] ?? "Library")
        : "Library";

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-6 py-8">
      {continueReading.length > 0 && (
        <section className="space-y-4">
          <h2 className="font-heading text-lg">Continue reading</h2>
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {continueReading.map((row) => (
              <BookCard key={row.book.id} book={row.book} progressPercent={row.percent} />
            ))}
          </div>
        </section>
      )}

      <section className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="font-heading text-2xl">{pageTitle}</h1>
          <div className="flex items-center gap-3">
            <form action="/" method="get">
              {shelfFilter && <input type="hidden" name="shelf" value={shelfFilter} />}
              {categoryFilter && <input type="hidden" name="category" value={categoryFilter} />}
              <Input
                type="search"
                name="q"
                placeholder="Search title or author…"
                defaultValue={query ?? ""}
                className="w-48 sm:w-56"
              />
            </form>
            <AddBookDialog categories={categories ?? []} />
          </div>
        </div>

        {!books?.length ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-24 text-center">
            <h2 className="font-heading text-xl">Nothing here yet</h2>
            <p className="max-w-sm text-muted-foreground">
              {query ? `No books match "${query}".` : "Add a book to see it here."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {books.map((book) => (
              <BookCard key={book.id} book={book} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
