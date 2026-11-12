import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";

function SkeletonRegion({ label, children }: { label: string; children: ReactNode }) {
  return <div role="status" aria-live="polite"><span className="sr-only">{label}</span><div aria-hidden>{children}</div></div>;
}
function Cell({ grow = 1, header = false }: { grow?: number; header?: boolean }) {
  return <Skeleton className={header ? "h-3" : "h-4"} style={{ flexGrow: grow, flexBasis: 0 }} />;
}
function VisualTable({ rows, columns }: { rows: number; columns: number }) {
  const widths = Array.from({ length: columns }, (_, index) => index === 0 ? 1.5 : index === columns - 1 ? 0.8 : 1);
  return <div className="overflow-hidden rounded-lg border"><div className="flex gap-3 bg-muted/40 p-3">{widths.map((width, index) => <Cell key={index} grow={width} header />)}</div>{Array.from({ length: rows }, (_, row) => <div key={row} className="flex gap-3 border-t p-3">{widths.map((width, index) => <Cell key={index} grow={width} />)}</div>)}</div>;
}
function FieldGrid({ fields = 5 }: { fields?: number }) {
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{Array.from({ length: fields }, (_, index) => <div key={index} className="space-y-2"><Skeleton className="h-3 w-24" /><Skeleton className="h-9 w-full" /></div>)}</div>;
}
function StatCards({ count = 4 }: { count?: number }) {
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: count }, (_, index) => <div key={index} className="space-y-3 rounded-lg border bg-card p-4"><Skeleton className="h-3 w-24" /><Skeleton className="h-6 w-32" /></div>)}</div>;
}
function Pane({ columns = 5 }: { columns?: number }) {
  return <div className="space-y-3 rounded-lg border bg-card p-4"><div className="flex items-center justify-between gap-3"><Skeleton className="h-5 w-36" /><div className="flex gap-2"><Skeleton className="h-8 w-20" /><Skeleton className="h-8 w-24" /></div></div><VisualTable rows={4} columns={columns} /></div>;
}

export function SetupSkeleton({ label = "Loading reconciliation setup" }: { label?: string }) {
  return <SkeletonRegion label={label}><div className="space-y-5"><div className="space-y-3"><Skeleton className="h-7 w-40" /><Skeleton className="h-4 w-full max-w-2xl" /></div><div className="space-y-5 rounded-lg border bg-card p-4 sm:p-6"><FieldGrid /><div className="grid gap-4 sm:grid-cols-3">{Array.from({ length: 3 }, (_, index) => <div key={index} className="space-y-2"><Skeleton className="h-3 w-32" /><Skeleton className="h-9 w-full" /></div>)}</div><div className="flex items-center justify-between gap-3 rounded-md bg-muted/40 p-3"><div className="space-y-2"><Skeleton className="h-4 w-48" /><Skeleton className="h-3 w-64" /></div><Skeleton className="h-9 w-40" /></div></div><StatCards /></div></SkeletonRegion>;
}

export function ProofSkeleton({ label = "Loading reconciliation proof", count = 4 }: { label?: string; count?: number }) {
  return <SkeletonRegion label={label}><StatCards count={count} /></SkeletonRegion>;
}

export function TransactionPanesSkeleton({ label = "Loading transactions" }: { label?: string }) {
  return <SkeletonRegion label={label}><div className="grid gap-4 xl:grid-cols-2"><Pane /><Pane /></div></SkeletonRegion>;
}

export function PostingSkeleton({ label = "Loading Posting" }: { label?: string }) {
  return <SkeletonRegion label={label}><div className="space-y-5"><div className="space-y-3"><Skeleton className="h-7 w-36" /><Skeleton className="h-4 w-full max-w-2xl" /></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{Array.from({ length: 5 }, (_, index) => <div key={index} className="space-y-3 rounded-lg border bg-card p-4"><Skeleton className="h-3 w-24" /><Skeleton className="h-6 w-32" /></div>)}</div><div className="space-y-3 rounded-lg border bg-card p-4"><div className="flex items-center justify-between gap-3"><Skeleton className="h-5 w-36" /><Skeleton className="h-9 w-40" /></div><VisualTable rows={5} columns={7} /></div></div></SkeletonRegion>;
}

export function ReportsSkeleton({ label = "Loading reports" }: { label?: string }) {
  return <SkeletonRegion label={label}><div className="space-y-5"><div className="space-y-3"><Skeleton className="h-7 w-28" /><Skeleton className="h-4 w-full max-w-2xl" /></div><div className="grid gap-4 xl:grid-cols-2"><Pane columns={4} /><Pane columns={4} /></div><div className="space-y-3 rounded-lg border bg-card p-4"><div className="flex items-center justify-between gap-3"><Skeleton className="h-5 w-48" /><Skeleton className="h-8 w-28" /></div><VisualTable rows={5} columns={8} /></div><div className="space-y-3 rounded-lg border bg-card p-4"><div className="flex items-center justify-between gap-3"><Skeleton className="h-5 w-36" /><Skeleton className="h-8 w-32" /></div><VisualTable rows={4} columns={5} /></div></div></SkeletonRegion>;
}

export function HistorySkeleton({ label = "Loading history", columns = 4, rows = 4 }: { label?: string; columns?: number; rows?: number }) {
  return <SkeletonRegion label={label}><VisualTable rows={rows} columns={columns} /></SkeletonRegion>;
}

export function ChoiceListSkeleton({ label = "Loading choices", rows = 4 }: { label?: string; rows?: number }) {
  return <SkeletonRegion label={label}><div className="space-y-2 p-3">{Array.from({ length: rows }, (_, index) => <div key={index} className="space-y-2 rounded-md border p-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/2" /></div>)}</div></SkeletonRegion>;
}
