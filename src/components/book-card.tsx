import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { BookCover } from "@/components/book-cover";
import { Progress } from "@/components/ui/progress";
import { BookCardActions } from "@/components/book-card-actions";
import { BookCardMenu } from "@/components/book-card-menu";

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
};

export function BookCard({ book, categories = [], progressPercent }: {
  book: LibraryBook;
  categories?: { id: string; name: string }[];
  progressPercent?: number;
}) {
  return (
    <article className="group min-w-0">
      <div className="relative rounded-xl border border-border/60 bg-muted/50 p-5 pb-6 transition-colors group-hover:bg-muted/80 sm:p-6">
        <Link href={`/read/${book.id}`} aria-label={`Read ${book.title}`} className="mx-auto block w-[82%] max-w-44 rounded-lg transition-transform duration-300 group-hover:-translate-y-1.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
          <BookCover title={book.title} author={book.author} coverUrl={book.cover_url} />
        </Link>
        <BookCardActions bookId={book.id} initialFavorite={book.is_favorite} initialWantToRead={book.want_to_read} />
        <div className="absolute top-2 right-2">
          <BookCardMenu book={{ id: book.id, title: book.title, author: book.author, cover_url: book.cover_url, category_id: book.category_id ?? null }} categories={categories} />
        </div>
      </div>
      <div className="space-y-1.5 px-0.5 pt-3.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[9px] font-medium tracking-[0.12em] text-muted-foreground uppercase">{book.format}</span>
          {book.finished_at && <span className="text-[9px] text-accent-foreground">Finished</span>}
          {typeof progressPercent === "number" && <span className="text-[10px] text-primary tabular-nums">{Math.round(progressPercent)}% read</span>}
        </div>
        <Link href={`/read/${book.id}`} className="flex items-start justify-between gap-2 text-sm font-medium leading-snug hover:text-primary">
          <span className="line-clamp-2">{book.title}</span><ArrowUpRight className="mt-0.5 hidden size-3.5 shrink-0 text-muted-foreground group-hover:block" aria-hidden="true" />
        </Link>
        <p className="truncate text-xs text-muted-foreground">{book.author ?? "Unknown author"}</p>
        {typeof progressPercent === "number" && <Progress value={progressPercent} aria-label={`Reading progress for ${book.title}`} className="mt-2 h-1 bg-border" />}
      </div>
    </article>
  );
}
