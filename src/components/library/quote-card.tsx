"use client";

import { useState } from "react";
import { Quote as QuoteIcon, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QUOTES } from "@/lib/quotes";

// Today's epigraph, with a button to page through the rest.
export function QuoteCard({ initialIndex }: { initialIndex: number }) {
  const [index, setIndex] = useState(initialIndex);
  const quote = QUOTES[index % QUOTES.length];

  return (
    <section aria-label="Daily epigraph" className="surface p-4 sm:p-5">
      <div className="flex items-start gap-3 sm:gap-4">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-secondary text-sage">
          <QuoteIcon className="size-4" aria-hidden="true" />
        </span>
        <figure className="min-w-0 flex-1 space-y-2" aria-live="polite">
          <blockquote className="font-heading text-lg leading-7 text-pretty italic">&ldquo;{quote.text}&rdquo;</blockquote>
          <figcaption className="flex flex-wrap items-center gap-2">
            {quote.author && <span className="text-[11px] font-medium text-sage">— {quote.author}</span>}
            <span className="tag text-amber">Daily epigraph</span>
          </figcaption>
        </figure>
        {QUOTES.length > 1 && (
          <Button variant="ghost" size="icon-sm" aria-label="Show another quote" title="Show another quote" onClick={() => setIndex((value) => value + 1)} className="text-muted-foreground">
            <RefreshCw />
          </Button>
        )}
      </div>
    </section>
  );
}
