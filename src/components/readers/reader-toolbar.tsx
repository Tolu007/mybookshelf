"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, Check } from "lucide-react";
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
    <header className="flex items-center justify-between gap-4 border-b border-border px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <Link href="/" className="text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="truncate font-heading text-lg">{title}</h1>
      </div>
      <div className="flex items-center gap-3">
        {children}
        {minutes > 0 && (
          <span className="text-xs text-muted-foreground tabular-nums">
            {minutes}m this session
          </span>
        )}
        <Button
          variant={isFinished ? "secondary" : "outline"}
          size="sm"
          onClick={onMarkFinished}
          disabled={isFinished}
        >
          <Check /> {isFinished ? "Finished" : "Mark as finished"}
        </Button>
      </div>
    </header>
  );
}
