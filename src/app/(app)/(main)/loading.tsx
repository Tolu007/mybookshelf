import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return <div role="status" aria-label="Loading your library" className="page-shell space-y-8"><span className="sr-only">Opening your reading space…</span><div className="space-y-3"><Skeleton className="h-3 w-32" /><Skeleton className="h-10 w-60" /><Skeleton className="h-4 w-full max-w-96" /></div><Skeleton className="h-52 w-full rounded-2xl" /><div className="grid grid-cols-2 gap-5 sm:grid-cols-3 xl:grid-cols-4">{[0, 1, 2, 3].map((item) => <div key={item} className="space-y-3"><Skeleton className="aspect-4/5 rounded-xl" /><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/2" /></div>)}</div></div>;
}
