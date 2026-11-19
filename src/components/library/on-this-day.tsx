"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ArrowLeft, ArrowRight, ArrowUpRight, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { highlightColor } from "@/lib/highlight-colors";
import { pickMemories, type MemoryEntry } from "@/lib/on-this-day";

const subscribeNothing = () => () => {};

// Resurfaces something you wrote or highlighted on this date in an earlier
// year. The date is the viewer's own, so the pick happens in the browser;
// nothing renders until then, or if there's nothing to show.
export function OnThisDay({ entries }: { entries: MemoryEntry[] }) {
  const isClient = useSyncExternalStore(subscribeNothing, () => true, () => false);
  const [index, setIndex] = useState(0);
  if (!isClient) return null;

  const memories = pickMemories(entries, new Date());
  if (memories.length === 0) return null;

  const current = memories[Math.min(index, memories.length - 1)];
  const { entry } = current;
  const href = entry.book
    ? { pathname: `/read/${entry.book.id}`, query: entry.location ? { location: entry.location } : {} }
    : { pathname: "/journal" };

  return (
    <section aria-labelledby="on-this-day-heading" className="surface overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3">
        <h2 id="on-this-day-heading" className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
          <History className="size-3.5 text-amber" aria-hidden="true" /> On this day
          <span className="text-sage normal-case">· {current.label}</span>
        </h2>
        {memories.length > 1 && (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon-xs" aria-label="Previous memory" disabled={index === 0} onClick={() => setIndex(index - 1)}><ArrowLeft /></Button>
            <span className="meta" aria-live="polite">{index + 1} / {memories.length}</span>
            <Button variant="ghost" size="icon-xs" aria-label="Next memory" disabled={index >= memories.length - 1} onClick={() => setIndex(index + 1)}><ArrowRight /></Button>
          </div>
        )}
      </div>
      <div className="space-y-3 px-5 py-4">
        {entry.excerpt && (
          <blockquote
            className="line-clamp-4 border-l-[3px] pl-4 font-heading text-[17px] leading-7 text-muted-foreground italic"
            style={{ borderLeftColor: entry.kind === "highlight" ? highlightColor(entry.color).fill : "var(--sage)" }}
          >
            &ldquo;{entry.excerpt}&rdquo;
          </blockquote>
        )}
        {entry.note && <p className="line-clamp-4 font-heading text-[17px] leading-7 break-words whitespace-pre-wrap">{entry.note}</p>}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-card px-5 py-2.5">
        <p className="meta">
          {format(new Date(entry.createdAt), "MMMM d, yyyy")}
          {entry.book && <> · <span className="font-heading text-xs font-semibold text-foreground normal-case">{entry.book.title}</span></>}
        </p>
        <Link href={href} className="flex items-center gap-1.5 text-xs font-semibold text-sage hover:underline">
          {entry.book ? (entry.location ? "Return to this moment" : "Open book") : "Open journal"} <ArrowUpRight className="size-3.5" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
