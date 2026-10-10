import { BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

export function Brand({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span className="flex size-9 items-center justify-center rounded-xl bg-accent text-accent-foreground">
        <BookOpen className="size-5" strokeWidth={1.6} aria-hidden="true" />
      </span>
      <span className="font-heading text-[30px] leading-none font-medium tracking-[-0.06em]">shelf<span className="text-primary">.</span></span>
    </span>
  );
}

export function ReadingArt({ className }: { className?: string }) {
  return (
    <div className={cn("reading-art", className)} aria-hidden="true">
      <div><small>Wander</small><span>The quiet<br />hours</span><i /></div>
      <div><small>Discover</small><span>Room<br />to think</span><i /></div>
      <div><small>Get lost</small><span>One more<br />chapter</span><i /></div>
    </div>
  );
}
