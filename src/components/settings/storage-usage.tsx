"use client";

import { useEffect, useState } from "react";
import { HardDrive } from "lucide-react";
import { formatBytes } from "@/lib/bytes";

export type StorageReport = {
  shelfBytes: number;
  bookCount: number;
  drive: { usage: number; limit: number | null } | null;
};

export function StorageBar({ report }: { report: StorageReport }) {
  const { shelfBytes, bookCount, drive } = report;
  const limit = drive?.limit ?? null;
  const percent = (bytes: number) => (limit ? Math.min(100, (bytes / limit) * 100) : 0);
  const otherBytes = drive ? Math.max(0, drive.usage - shelfBytes) : 0;

  return (
    <div className="space-y-3">
      <p className="text-sm">
        Shelf uses <span className="font-heading text-lg font-semibold tabular-nums">{formatBytes(shelfBytes)}</span>{" "}
        <span className="text-muted-foreground">across {bookCount} {bookCount === 1 ? "book" : "books"}</span>
        {limit && drive && <span className="text-muted-foreground"> of {formatBytes(limit)} in your Drive ({formatBytes(drive.usage)} used in total)</span>}
        {drive && !limit && <span className="text-muted-foreground">. Your Drive has no storage limit.</span>}
      </p>
      {limit && drive && (
        <>
          <div role="img" aria-label={`Shelf uses ${formatBytes(shelfBytes)}, other files ${formatBytes(otherBytes)}, of ${formatBytes(limit)}`} className="flex h-2 overflow-hidden rounded-full bg-secondary dark:bg-background">
            <div className="h-full bg-primary" style={{ width: `${percent(shelfBytes)}%` }} />
            <div className="h-full bg-ribbon" style={{ width: `${percent(otherBytes)}%` }} />
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-primary" aria-hidden="true" /> Shelf books</span>
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-ribbon" aria-hidden="true" /> Other Drive files</span>
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-secondary ring-1 ring-border" aria-hidden="true" /> Free: {formatBytes(Math.max(0, limit - drive.usage))}</span>
          </div>
        </>
      )}
      {!drive && <p className="text-xs text-muted-foreground">Google Drive&apos;s overall usage couldn&apos;t be read right now; this is Shelf&apos;s share only.</p>}
    </div>
  );
}

// Loads after the page so the Google call doesn't hold up Settings.
export function StorageUsage() {
  const [report, setReport] = useState<StorageReport | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/storage")
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("storage"))))
      .then((data: StorageReport) => {
        if (!cancelled) setReport(data);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="rounded-lg border border-border bg-background p-4 dark:bg-secondary/50">
      <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><HardDrive className="size-4 text-sage" aria-hidden="true" /> Storage in your Google Drive</p>
      {report ? (
        <StorageBar report={report} />
      ) : failed ? (
        <p role="alert" className="text-xs text-destructive">Storage usage couldn&apos;t be loaded. Try again later.</p>
      ) : (
        <p role="status" className="text-xs text-muted-foreground">Checking storage…</p>
      )}
    </div>
  );
}
