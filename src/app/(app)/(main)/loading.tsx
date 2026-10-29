import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div role="status" aria-label="Loading" className="page-shell space-y-8">
      <span className="sr-only">Opening your reading space…</span>
      <div className="space-y-3">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-10 w-full max-w-xl" />
      </div>
      <Skeleton className="h-24 w-full rounded-xl" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((item) => <Skeleton key={item} className="h-52 rounded-xl" />)}
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
        {[0, 1, 2, 3, 4].map((item) => (
          <div key={item} className="space-y-2.5 rounded-xl border border-border p-3">
            <Skeleton className="aspect-2/3 rounded-md" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}
