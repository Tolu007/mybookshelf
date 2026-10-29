"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, BookMarked, LayoutGrid, List } from "lucide-react";
import { BookCard, FormatBadge } from "@/components/book-card";
import { BookCover } from "@/components/book-cover";
import { BookCardMenu } from "@/components/book-card-menu";
import { Button } from "@/components/ui/button";
import { libraryHref, type LibraryParams, type Shelf } from "@/lib/library";
import { cn } from "@/lib/utils";

export function LibraryShelves({ shelves, tabs, params, categories }: {
  shelves: Shelf[];
  // Category tabs with counts across the current search/shelf/format filters.
  tabs: { id: string; name: string; count: number }[];
  params: LibraryParams;
  categories: { id: string; name: string }[];
}) {
  const [view, setView] = useState<"grid" | "list">("grid");
  const total = tabs.reduce((sum, tab) => sum + tab.count, 0);

  return (
    <section aria-labelledby="shelves-heading" className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 id="shelves-heading" className="font-heading text-xl leading-7 font-semibold">Curated shelves</h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {total} {total === 1 ? "book" : "books"} across {tabs.length} {tabs.length === 1 ? "shelf" : "shelves"}
          </p>
        </div>
        <div className="flex min-w-0 items-center gap-3">
          <nav aria-label="Filter by shelf" className="flex min-w-0 gap-1 overflow-x-auto pb-1">
            {[{ id: "", name: "All shelves", count: total }, ...tabs].map((tab) => {
              const active = (params.category ?? "") === tab.id;
              return (
                <Link
                  key={tab.id || "all"}
                  href={libraryHref(params, { category: tab.id })}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "shrink-0 rounded-lg border px-3 py-1 text-xs font-semibold tracking-[0.02em] whitespace-nowrap transition-colors",
                    active ? "border-primary/30 bg-primary text-primary-foreground" : "border-transparent text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                >
                  {tab.name}{tab.id && <span className="font-normal tabular-nums"> ({tab.count})</span>}
                </Link>
              );
            })}
          </nav>
          <div className="flex shrink-0 rounded-lg border border-border bg-card p-0.5" role="group" aria-label="Collection layout">
            <Button variant="ghost" size="icon-sm" aria-label="Grid view" aria-pressed={view === "grid"} onClick={() => setView("grid")} className={cn(view === "grid" && "bg-secondary text-sage")}><LayoutGrid className="size-3.5" /></Button>
            <Button variant="ghost" size="icon-sm" aria-label="List view" aria-pressed={view === "list"} onClick={() => setView("list")} className={cn(view === "list" && "bg-secondary text-sage")}><List className="size-3.5" /></Button>
          </div>
        </div>
      </div>

      {shelves.map((shelf) => (
        <section key={shelf.id} aria-label={shelf.name} className="space-y-3">
          <div className="flex items-baseline justify-between gap-3 rounded-lg border border-border bg-card px-4 py-2">
            <h3 className="flex min-w-0 items-center gap-2.5">
              <BookMarked className="size-4 shrink-0 self-center text-sage" aria-hidden="true" />
              <span className="truncate font-heading text-lg leading-6 font-semibold">{shelf.name}</span>
              <span className="meta shrink-0">{shelf.books.length} {shelf.books.length === 1 ? "work" : "works"}</span>
            </h3>
          </div>
          {view === "grid" ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
              {shelf.books.map((book) => <BookCard key={book.id} book={book} categories={categories} />)}
            </div>
          ) : (
            <div className="surface divide-y divide-border overflow-hidden">
              {shelf.books.map((book) => (
                <article key={book.id} className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-secondary/60">
                  <Link href={`/read/${book.id}`} aria-label={`Read ${book.title}`} className="w-10 shrink-0 overflow-hidden rounded-sm ring-1 ring-border"><BookCover title={book.title} author={book.author} coverUrl={book.cover_url} sizes="40px" compact /></Link>
                  <div className="min-w-0 flex-1">
                    <Link href={`/read/${book.id}`} className="block truncate font-heading text-base font-semibold hover:text-sage">{book.title}</Link>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{book.author ?? "Unknown author"}</p>
                  </div>
                  {book.percent !== null && !book.finished_at && <span className="meta hidden sm:block">{Math.round(book.percent)}%</span>}
                  <FormatBadge format={book.format} />
                  <Link href={`/read/${book.id}`} aria-label={`Open ${book.title}`} className="hidden rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground sm:block"><ArrowUpRight className="size-4" /></Link>
                  <BookCardMenu book={{ ...book, category_id: book.category_id ?? null }} categories={categories} />
                </article>
              ))}
            </div>
          )}
        </section>
      ))}
    </section>
  );
}
