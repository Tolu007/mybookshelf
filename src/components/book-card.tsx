import Link from "next/link";
import { Star } from "lucide-react";
import { BookCover } from "@/components/book-cover";
import { BookCardActions } from "@/components/book-card-actions";
import { BookCardMenu } from "@/components/book-card-menu";
import { bookStatus, type BookStatus } from "@/lib/library";
import { formatRating } from "@/lib/rating";
import { cn } from "@/lib/utils";

export type LibraryBook = {
  id: string;
  title: string;
  author: string | null;
  cover_url: string | null;
  format: string;
  want_to_read: boolean;
  is_favorite: boolean;
  category_id?: string | null;
  finished_at?: string | null;
  percent?: number | null;
  rating?: number | null;
};

const STATUS_BADGE: Record<BookStatus, { label: string; className: string } | null> = {
  finished: { label: "Finished", className: "border-primary/30 bg-primary text-primary-foreground" },
  reading: { label: "Reading", className: "border-border bg-popover text-sage" },
  want_to_read: { label: "Want to read", className: "border-transparent bg-ribbon text-ribbon-foreground" },
  unread: null,
};

export function FormatBadge({ format, className }: { format: string; className?: string }) {
  return (
    <span className={cn("rounded-sm border border-border bg-popover/90 px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.04em] text-sage uppercase backdrop-blur-sm", className)}>
      {format}
    </span>
  );
}

export function BookCard({ book, categories = [] }: {
  book: LibraryBook;
  categories?: { id: string; name: string }[];
}) {
  const percent = book.percent ?? null;
  const badge = STATUS_BADGE[bookStatus({ finished_at: book.finished_at ?? null, percent, want_to_read: book.want_to_read })];

  return (
    <article className="group surface surface-lift flex min-w-0 flex-col p-2.5 sm:p-3">
      <div className="relative mb-2.5">
        <Link href={`/read/${book.id}`} aria-label={`Read ${book.title}`} className="block overflow-hidden rounded-md bg-well ring-1 ring-border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
          <BookCover title={book.title} author={book.author} coverUrl={book.cover_url} className="transition-transform duration-300 group-hover:scale-[1.03]" />
        </Link>
        <FormatBadge format={book.format} className="pointer-events-none absolute top-1.5 left-1.5" />
        {badge && (
          <span className={cn("pointer-events-none absolute right-1.5 bottom-1.5 rounded-sm border px-1.5 py-0.5 text-[10px] font-medium shadow-sm", badge.className)}>
            {badge.label}
          </span>
        )}
        <div className="absolute top-1 right-1 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100 sm:has-aria-expanded:opacity-100">
          <BookCardMenu book={{ id: book.id, title: book.title, author: book.author, cover_url: book.cover_url, category_id: book.category_id ?? null, rating: book.rating ?? null }} categories={categories} />
        </div>
      </div>
      <Link href={`/read/${book.id}`} className="truncate font-heading text-[15px] leading-5 font-semibold transition-colors hover:text-sage">
        {book.title}
      </Link>
      <p className="mt-0.5 truncate text-[11px] tracking-[0.02em] text-muted-foreground">{book.author ?? "Unknown author"}</p>
      <div className="mt-2 flex items-center justify-between gap-2 border-t border-border/60 pt-1.5">
        <BookCardActions bookId={book.id} initialFavorite={book.is_favorite} initialWantToRead={book.want_to_read} />
        <span className="flex items-center gap-2">
          {book.rating ? (
            <span role="img" aria-label={`Rated ${formatRating(book.rating)} out of 5`} className="flex items-center gap-0.5 text-[11px] font-semibold text-amber tabular-nums">
              <Star className="size-3 fill-amber" aria-hidden="true" /> {formatRating(book.rating)}
            </span>
          ) : null}
          {percent !== null && !book.finished_at && <span className="meta">{Math.round(percent)}%</span>}
        </span>
      </div>
    </article>
  );
}
