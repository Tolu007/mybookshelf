"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, LayoutGrid, List } from "lucide-react";
import { BookCard, type LibraryBook } from "@/components/book-card";
import { BookCover } from "@/components/book-cover";
import { BookCardMenu } from "@/components/book-card-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function LibraryCollection({ books, categories }: {
  books: LibraryBook[];
  categories: { id: string; name: string }[];
}) {
  const [view, setView] = useState<"grid" | "list">("grid");
  const [sort, setSort] = useState("recent");
  const sorted = [...books].sort((a, b) => sort === "title" ? a.title.localeCompare(b.title) : sort === "author" ? (a.author ?? "").localeCompare(b.author ?? "") : 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">{books.length} {books.length === 1 ? "book" : "books"} in this collection</p>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="sr-only sm:not-sr-only">Sort by</span>
            <select aria-label="Sort books" value={sort} onChange={(event) => setSort(event.target.value)} className="min-h-9 max-w-40 rounded-lg border border-border bg-background px-2 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <option value="recent">Recently added</option><option value="title">Title, A–Z</option><option value="author">Author, A–Z</option>
            </select>
          </label>
          <div className="flex rounded-lg border border-border bg-card p-0.5" role="group" aria-label="Collection layout">
            <Button variant="ghost" size="icon-sm" aria-label="Grid view" aria-pressed={view === "grid"} onClick={() => setView("grid")} className={cn(view === "grid" && "bg-accent text-accent-foreground")}><LayoutGrid className="size-3.5" /></Button>
            <Button variant="ghost" size="icon-sm" aria-label="List view" aria-pressed={view === "list"} onClick={() => setView("list")} className={cn(view === "list" && "bg-accent text-accent-foreground")}><List className="size-3.5" /></Button>
          </div>
        </div>
      </div>
      {view === "grid" ? (
        <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 xl:grid-cols-4">
          {sorted.map((book) => <BookCard key={book.id} book={book} categories={categories} />)}
        </div>
      ) : (
        <div className="surface divide-y divide-border overflow-hidden">
          {sorted.map((book) => (
            <article key={book.id} className="flex items-center gap-4 p-4 sm:px-5">
              <Link href={`/read/${book.id}`} aria-label={`Read ${book.title}`} className="w-10 shrink-0"><BookCover title={book.title} author={book.author} coverUrl={book.cover_url} sizes="40px" compact /></Link>
              <div className="min-w-0 flex-1"><Link href={`/read/${book.id}`} className="block truncate text-sm font-medium hover:text-primary">{book.title}</Link><p className="mt-1 truncate text-xs text-muted-foreground">{book.author ?? "Unknown author"}</p></div>
              <span className="text-[10px] text-muted-foreground uppercase">{book.format}</span>
              {book.is_favorite && <span className="sr-only">Favorite</span>}
              <Link href={`/read/${book.id}`} aria-label={`Open ${book.title}`} className="hidden rounded-lg p-2 text-muted-foreground hover:bg-accent sm:block"><ArrowUpRight className="size-4" /></Link>
              <BookCardMenu book={{ ...book, category_id: book.category_id ?? null }} categories={categories} />
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
