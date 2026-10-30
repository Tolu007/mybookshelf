import Link from "next/link";
import { format } from "date-fns";
import { BookCheck } from "lucide-react";
import { BookCover } from "@/components/book-cover";
import { formatMinutes } from "@/lib/stats-aggregate";

export type FinishedBookRow = {
  id: string;
  title: string;
  author: string | null;
  cover_url: string | null;
  finished_at: string;
  shelf: string | null;
  // Across every session for the book, not just the selected period.
  minutes: number;
  sessions: number;
};

export function FinishedBooksTable({ books, periodName }: { books: FinishedBookRow[]; periodName: string }) {
  return (
    <section aria-labelledby="finished-heading" className="surface overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 px-5 pt-5 sm:px-6">
        <h2 id="finished-heading" className="font-heading text-xl leading-7 font-semibold">Books finished</h2>
        <span className="tag border-primary/30 bg-primary text-primary-foreground">{books.length} in {periodName}</span>
      </div>
      <p className="mt-1 px-5 text-[13px] text-muted-foreground sm:px-6">Newest first. Time and sessions count every reading of the book.</p>

      {books.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
          <BookCheck className="size-6 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
          <p className="text-sm text-muted-foreground">No books finished in {periodName} yet. Use &ldquo;Finish book&rdquo; in the reader when you reach the end.</p>
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-y border-border bg-secondary text-[10px] font-semibold tracking-[0.06em] text-muted-foreground uppercase dark:bg-background">
                <th scope="col" className="px-5 py-2.5 sm:px-6">Book</th>
                <th scope="col" className="px-3 py-2.5">Shelf</th>
                <th scope="col" className="px-3 py-2.5">Finished</th>
                <th scope="col" className="px-3 py-2.5 text-right">Time invested</th>
                <th scope="col" className="px-5 py-2.5 text-right sm:px-6">Sessions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {books.map((book) => (
                <tr key={book.id} className="transition-colors hover:bg-secondary/60">
                  <td className="px-5 py-3 sm:px-6">
                    <Link href={`/read/${book.id}`} className="flex min-w-0 items-center gap-3 hover:text-sage">
                      <span className="w-9 shrink-0 overflow-hidden rounded-sm ring-1 ring-border">
                        <BookCover title={book.title} author={book.author} coverUrl={book.cover_url} sizes="36px" compact />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-heading text-base leading-5 font-semibold">{book.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">{book.author ?? "Unknown author"}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-3 py-3">{book.shelf ? <span className="tag">{book.shelf}</span> : <span className="text-xs text-muted-foreground">—</span>}</td>
                  <td className="px-3 py-3 whitespace-nowrap tabular-nums">
                    <time dateTime={book.finished_at}>{format(new Date(book.finished_at), "MMM d, yyyy")}</time>
                  </td>
                  <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums">{book.minutes > 0 ? formatMinutes(book.minutes) : "—"}</td>
                  <td className="px-5 py-3 text-right tabular-nums sm:px-6">{book.sessions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
