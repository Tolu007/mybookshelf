import Image from "next/image";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { BookCardActions } from "@/components/book-card-actions";
import { BookCardMenu } from "@/components/book-card-menu";

export function BookCard({
  book,
  categories = [],
  progressPercent,
}: {
  book: {
    id: string;
    title: string;
    author: string | null;
    cover_url: string | null;
    format: string;
    want_to_read: boolean;
    is_favorite: boolean;
    category_id?: string | null;
  };
  categories?: { id: string; name: string }[];
  progressPercent?: number;
}) {
  const isDataUrl = book.cover_url?.startsWith("data:");

  return (
    <Link href={`/read/${book.id}`} className="group block">
      <Card className="overflow-hidden py-0 shadow-sm transition-all duration-200 group-hover:-translate-y-1 group-hover:shadow-lg">
        <CardContent className="p-0">
          <div className="relative aspect-2/3 overflow-hidden bg-muted">
            {book.cover_url ? (
              isDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- local data: URL, not optimizable
                <img src={book.cover_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <Image
                  src={book.cover_url}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 45vw, (max-width: 1024px) 220px, 240px"
                  className="object-cover"
                />
              )
            ) : (
              <div className="flex h-full items-center justify-center bg-gradient-to-br from-muted to-muted/60">
                <span className="font-heading text-3xl text-muted-foreground/70">
                  {book.title.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
            <BookCardActions
              bookId={book.id}
              initialFavorite={book.is_favorite}
              initialWantToRead={book.want_to_read}
            />
            <div className="absolute top-2 right-2 flex items-center gap-1">
              <BookCardMenu
                book={{
                  id: book.id,
                  title: book.title,
                  author: book.author,
                  cover_url: book.cover_url,
                  category_id: book.category_id ?? null,
                }}
                categories={categories}
              />
              <Badge
                variant="secondary"
                className="bg-background/85 text-[10px] uppercase backdrop-blur-sm"
              >
                {book.format}
              </Badge>
            </div>
            {typeof progressPercent === "number" && (
              <div className="absolute inset-x-0 bottom-0 bg-background/85 px-2 py-1.5 backdrop-blur-sm">
                <Progress value={progressPercent} className="h-1" />
              </div>
            )}
          </div>
          <div className="space-y-0.5 p-3">
            <p className="truncate text-sm font-medium">{book.title}</p>
            {book.author && (
              <p className="truncate text-xs text-muted-foreground">{book.author}</p>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
