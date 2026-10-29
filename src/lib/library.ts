// Pure helpers for the library page: filtering, sorting, grouping into
// category shelves, and building filter URLs. Kept free of React and
// Supabase so they can be tested directly.

export type BookStatus = "finished" | "reading" | "want_to_read" | "unread";

export type ShelfBook = {
  id: string;
  title: string;
  author: string | null;
  cover_url: string | null;
  format: string;
  want_to_read: boolean;
  is_favorite: boolean;
  category_id: string | null;
  finished_at: string | null;
  added_at: string;
  // From reading_progress; null when the book has never been opened.
  percent: number | null;
  last_read_at: string | null;
};

export type LibraryParams = {
  q?: string;
  shelf?: string;
  category?: string;
  format?: string;
  sort?: string;
};

export const SHELF_FILTERS = [
  { key: "", label: "All books" },
  { key: "reading", label: "Reading" },
  { key: "want_to_read", label: "Want to read" },
  { key: "finished", label: "Finished" },
  { key: "favorites", label: "Favorites" },
] as const;

export const SORT_OPTIONS = [
  { key: "recent", label: "Recently added" },
  { key: "read", label: "Recently read" },
  { key: "progress", label: "Reading progress" },
  { key: "title", label: "Title (A–Z)" },
  { key: "author", label: "Author (A–Z)" },
] as const;

export const UNSHELVED = "unshelved";

export function bookStatus(book: Pick<ShelfBook, "finished_at" | "percent" | "want_to_read">): BookStatus {
  if (book.finished_at) return "finished";
  if (book.percent !== null && book.percent > 0) return "reading";
  if (book.want_to_read) return "want_to_read";
  return "unread";
}

function matchesShelf(book: ShelfBook, shelf: string | undefined) {
  switch (shelf) {
    case "reading":
      return !book.finished_at && book.percent !== null;
    case "want_to_read":
      return book.want_to_read;
    case "finished":
      return Boolean(book.finished_at);
    case "favorites":
      return book.is_favorite;
    default:
      return true;
  }
}

// Search, shelf and category filters; format is applied separately so the
// format pills can show counts for the rest of the active filters.
export function filterBooks(books: ShelfBook[], params: LibraryParams) {
  const query = params.q?.trim().toLowerCase();
  return books.filter((book) => {
    if (query && !book.title.toLowerCase().includes(query) && !(book.author ?? "").toLowerCase().includes(query)) return false;
    if (!matchesShelf(book, params.shelf)) return false;
    if (params.category === UNSHELVED) return !book.category_id;
    if (params.category && book.category_id !== params.category) return false;
    return true;
  });
}

export function filterByFormat(books: ShelfBook[], format: string | undefined) {
  return format === "pdf" || format === "epub" ? books.filter((book) => book.format === format) : books;
}

export function sortBooks(books: ShelfBook[], sort: string | undefined) {
  const byDateDesc = (a: string | null, b: string | null) => (b ?? "").localeCompare(a ?? "");
  const sorted = [...books];
  switch (sort) {
    case "read":
      return sorted.sort((a, b) => byDateDesc(a.last_read_at, b.last_read_at) || byDateDesc(a.added_at, b.added_at));
    case "progress":
      return sorted.sort((a, b) => (b.percent ?? -1) - (a.percent ?? -1));
    case "title":
      return sorted.sort((a, b) => a.title.localeCompare(b.title));
    case "author":
      return sorted.sort((a, b) => (a.author ?? "").localeCompare(b.author ?? ""));
    default:
      return sorted.sort((a, b) => byDateDesc(a.added_at, b.added_at));
  }
}

export type Shelf = { id: string; name: string; books: ShelfBook[] };

// One shelf per category in name order, then books with no category.
export function groupIntoShelves(books: ShelfBook[], categories: { id: string; name: string }[]): Shelf[] {
  const shelves: Shelf[] = categories.map((category) => ({
    id: category.id,
    name: category.name,
    books: books.filter((book) => book.category_id === category.id),
  }));
  const known = new Set(categories.map((category) => category.id));
  shelves.push({ id: UNSHELVED, name: "Unshelved", books: books.filter((book) => !book.category_id || !known.has(book.category_id)) });
  return shelves.filter((shelf) => shelf.books.length > 0);
}

// A library URL with some params replaced; empty values are dropped.
export function libraryHref(params: LibraryParams, overrides: Partial<LibraryParams>) {
  const merged = { ...params, ...overrides };
  const search = new URLSearchParams();
  for (const key of ["q", "shelf", "category", "format", "sort"] as const) {
    const value = merged[key];
    if (value) search.set(key, value);
  }
  const query = search.toString();
  return query ? `/?${query}` : "/";
}
