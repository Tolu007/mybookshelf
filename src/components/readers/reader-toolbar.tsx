"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, Check, Clock3 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ReaderToolbar({
  title,
  elapsedSeconds,
  isFinished,
  onMarkFinished,
  children,
}: {
  title: string;
  elapsedSeconds: number;
  isFinished: boolean;
  onMarkFinished: () => void;
  children?: ReactNode;
}) {
  const minutes = Math.floor(elapsedSeconds / 60);

  return (
    <header className="z-10 shrink-0 border-b border-border bg-card/90 px-4 py-3 sm:px-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/" aria-label="Back to your library" className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
            <ArrowLeft className="size-5" />
          </Link>
          <div className="min-w-0"><p className="eyebrow hidden sm:block">In the pages</p><h1 className="truncate font-heading text-base tracking-tight sm:text-xl">{title}</h1></div>
        </div>
        <div className="flex shrink-0 items-center gap-4">
          {minutes > 0 && (
            <span className="hidden items-center gap-1.5 text-[10px] text-muted-foreground tabular-nums sm:flex">
              <Clock3 className="size-3" aria-hidden="true" /> {minutes}m this session
            </span>
          )}
          <Button variant={isFinished ? "secondary" : "outline"} size="sm" onClick={onMarkFinished} disabled={isFinished}>
            <Check /> {isFinished ? "Finished" : "Finish book"}
          </Button>
        </div>
      </div>
      <div role="group" aria-label="Reading controls" className="mt-3 flex items-center gap-2 overflow-x-auto border-t border-border/60 pt-3 pb-1 sm:justify-center [&>*]:shrink-0">{children}</div>
    </header>
  );
}
