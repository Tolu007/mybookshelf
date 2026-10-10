import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";
import { ReadingArt } from "@/components/brand";
import { BookCover } from "@/components/book-cover";
import { Progress } from "@/components/ui/progress";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ReadingHero({ current }: { current?: {
  percent: number;
  book: { id: string; title: string; author: string | null; cover_url: string | null };
} }) {
  return (
    <section aria-label={current ? "Your next chapter" : "Welcome to your reading space"} className="relative flex min-h-56 items-center justify-between gap-6 overflow-hidden rounded-2xl border border-accent bg-[#e9eee3] px-6 py-7 sm:px-8 dark:bg-[#27372b]">
      <div className="relative z-10 max-w-lg space-y-3">
        <p className="flex items-center gap-2 text-[9px] font-semibold tracking-[0.17em] text-accent-foreground uppercase"><BookOpen className="size-3.5" aria-hidden="true" /> {current ? "Your next chapter" : "A little reading, every day"}</p>
        <h2 className="font-heading text-2xl leading-tight tracking-[-0.025em] text-foreground sm:text-3xl">{current ? current.book.title : <>A quieter corner.<br />A bigger world.</>}</h2>
        <p className="text-xs leading-relaxed text-muted-foreground">{current ? (current.book.author ?? "Right where you left off. Ready when you are.") : "Keep your books, your thoughts, and your next great read together."}</p>
        {current ? (
          <>
            <div className="flex max-w-64 items-center gap-3 pt-1"><Progress value={current.percent} aria-label="Current book progress" className="h-1.5 bg-foreground/10" /><span className="shrink-0 text-[10px] text-muted-foreground">{Math.round(current.percent)}% read</span></div>
            <Link href={`/read/${current.book.id}`} className={cn(buttonVariants({ size: "sm" }), "mt-2 bg-[#354d3d] text-[#f4f1e8] hover:bg-[#293e30] dark:bg-[#ccd9c0] dark:text-[#233325] dark:hover:bg-[#dce5d3]")}>Continue reading <ArrowRight className="size-3.5" /></Link>
          </>
        ) : <Link href="/journal" className="inline-flex items-center gap-2 pt-2 text-xs font-medium text-accent-foreground hover:underline">Explore your journal <ArrowRight className="size-3.5" /></Link>}
      </div>
      {current ? <div className="hidden w-28 shrink-0 -rotate-6 sm:block lg:mr-8"><BookCover title={current.book.title} author={current.book.author} coverUrl={current.book.cover_url} sizes="112px" /></div> : <ReadingArt className="hidden shrink-0 opacity-95 sm:block" />}
    </section>
  );
}
