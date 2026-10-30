import { Download, FileJson, FileText } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { SettingsSection } from "@/components/settings/settings-section";
import { StorageUsage } from "@/components/settings/storage-usage";
import { cn } from "@/lib/utils";

export function DataSection() {
  return (
    <SettingsSection id="data" index="05" title="Your data" description="Where your books are stored, and a copy of everything Shelf keeps about your reading.">
      <StorageUsage />
      <div className="rounded-lg border border-border bg-background p-4 dark:bg-secondary/50">
        <p className="flex items-center gap-2 text-sm font-semibold"><Download className="size-4 text-sage" aria-hidden="true" /> Export your library</p>
        <p className="mt-1 mb-3 text-xs leading-relaxed text-muted-foreground">
          Books, shelves, progress, notes, highlights, bookmarks, reading sessions and settings. The book files themselves are already in your Google Drive.
        </p>
        <div className="flex flex-wrap gap-2">
          <a href="/api/export?format=markdown" download className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            <FileText /> Markdown (.md)
          </a>
          <a href="/api/export?format=json" download className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            <FileJson /> Full data (.json)
          </a>
        </div>
      </div>
    </SettingsSection>
  );
}
