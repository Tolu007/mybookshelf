import Image from "next/image";
import { cn } from "@/lib/utils";
import { BookOpen } from "lucide-react";

const PALETTES = ["bg-[#374f43]", "bg-[#a05a43]", "bg-[#3e5063]", "bg-[#a0834c]", "bg-[#6c5c70]"];

export function BookCover({ title, author, coverUrl, className, compact = false, sizes = "(max-width: 640px) 40vw, (max-width: 1024px) 180px, 200px" }: {
  title: string;
  author: string | null;
  coverUrl: string | null;
  className?: string;
  compact?: boolean;
  sizes?: string;
}) {
  const palette = Array.from(title).reduce((sum, char) => sum + char.charCodeAt(0), 0) % PALETTES.length;
  return (
    <div className={cn("book-jacket relative aspect-2/3 overflow-hidden rounded-[3px_7px_7px_3px]", PALETTES[palette], className)}>
      {coverUrl ? (
        coverUrl.startsWith("data:") ? (
          // eslint-disable-next-line @next/next/no-img-element -- embedded cover, not optimizable
          <img src={coverUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : <Image src={coverUrl} alt="" fill sizes={sizes} className="object-cover" />
      ) : compact ? <div className="flex h-full items-center justify-center text-[#fff8e7]"><BookOpen className="size-4" strokeWidth={1.2} aria-hidden="true" /></div> : (
        <div className="flex h-full flex-col justify-between p-[12%] text-[#fff8e7]">
          <span className="truncate border-b border-white/25 pb-[6cqw] text-[clamp(5px,5cqw,8px)] tracking-[0.14em] uppercase">Personal collection</span>
          <p className="line-clamp-4 font-heading text-[clamp(10px,13cqw,26px)] leading-tight">{title}</p>
          <div><div className="mb-[6cqw] size-[18cqw] max-h-7 max-w-7 rounded-full border border-white/35" /><p className="line-clamp-2 text-[clamp(5px,5cqw,9px)] tracking-wide opacity-80">{author ?? "A new perspective awaits"}</p></div>
        </div>
      )}
    </div>
  );
}
