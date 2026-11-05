import { Skeleton } from "@/components/ui/skeleton";

function SkeletonField({ className = "" }: { className?: string }) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}

export function AjeEntryEditorSkeleton() {
  return (
    <div role="status" aria-busy="true" className="space-y-5">
      <span className="sr-only">Loading adjusting entry form</span>

      <section className="space-y-4 rounded-md border p-3 sm:p-4">
        <div className="space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-2/3" />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <SkeletonField />
          <SkeletonField />
          <SkeletonField />
          <SkeletonField />
          <SkeletonField className="md:col-span-2" />
          <div className="space-y-1.5 md:col-span-3">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-20 w-full" />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-3 w-64 max-w-full" />
          </div>
          <Skeleton className="h-9 w-24 shrink-0" />
        </div>
        <div className="space-y-3 md:hidden">
          {Array.from({ length: 2 }, (_, row) => (
            <div key={row} className="space-y-3 rounded-md border p-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-10 w-full" />
              <div className="grid grid-cols-2 gap-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
          ))}
          <div className="grid grid-cols-2 gap-3 rounded-md bg-muted/30 p-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
        <div className="hidden overflow-hidden rounded-md border md:block">
          <div className="grid grid-cols-5 gap-3 bg-muted/30 p-3">
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} className="h-4 w-3/4" />
            ))}
          </div>
          {Array.from({ length: 2 }, (_, row) => (
            <div key={row} className="grid grid-cols-5 gap-3 border-t p-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
          <div className="flex justify-between border-t bg-muted/20 p-3">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-36" />
          </div>
        </div>
      </section>

      <section className="space-y-3 rounded-md border p-3 sm:p-4">
        <div className="space-y-2">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-3 w-80 max-w-full" />
        </div>
        <Skeleton className="h-10 w-full" />
      </section>

      <div className="flex justify-end gap-2 border-t pt-4">
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-32" />
      </div>
    </div>
  );
}
