import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";

function SkeletonRegion({ label, children }: { label: string; children: ReactNode }) {
  return <div role="status" aria-live="polite"><span className="sr-only">{label}</span><div aria-hidden>{children}</div></div>;
}
function Cell({ grow = 1, header = false }: { grow?: number; header?: boolean }) {
  return <Skeleton className={header ? "h-3" : "h-4"} style={{ flexGrow: grow, flexBasis: 0 }} />;
}
function VisualTable({ rows, columns }: { rows: number; columns: number }) {
  const widths = Array.from({ length: columns }, (_, index) => index === 0 ? 1.6 : index === columns - 1 ? 0.7 : 1);
  return <div className="overflow-hidden rounded-lg border"><div className="flex gap-3 bg-muted/40 p-3">{widths.map((width, index) => <Cell key={index} grow={width} header />)}</div>{Array.from({ length: rows }, (_, row) => <div key={row} className="flex gap-3 border-t p-3">{widths.map((width, index) => <Cell key={index} grow={width} />)}</div>)}</div>;
}
function CardListSkeleton({ rows }: { rows: number }) {
  return <div className="space-y-3">{Array.from({ length: rows }, (_, index) => <div key={index} className="space-y-3 rounded-lg border p-3"><div className="flex items-start justify-between gap-3"><div className="space-y-2"><Skeleton className="h-4 w-28" /><Skeleton className="h-3 w-40" /></div><Skeleton className="h-5 w-16 rounded-full" /></div><div className="grid grid-cols-2 gap-2">{Array.from({ length: 4 }, (_, field) => <Skeleton key={field} className="h-4 w-full" />)}</div></div>)}</div>;
}
export function TableSkeleton({ label, rows = 5, columns = 6 }: { label: string; rows?: number; columns?: number }) {
  return <SkeletonRegion label={label}><VisualTable rows={rows} columns={columns} /></SkeletonRegion>;
}
export function ResponsiveListSkeleton({ label, rows = 5, columns = 8 }: { label: string; rows?: number; columns?: number }) {
  return <SkeletonRegion label={label}><div className="space-y-3"><div className="hidden md:block"><VisualTable rows={rows} columns={columns} /></div><div className="md:hidden"><CardListSkeleton rows={Math.min(rows, 4)} /></div></div></SkeletonRegion>;
}
export function DetailsSkeleton({ label, rows = 6 }: { label: string; rows?: number }) {
  return <SkeletonRegion label={label}><div>{Array.from({ length: rows }, (_, index) => <div key={index} className="grid gap-2 border-b px-2 py-3 sm:grid-cols-[1fr_2fr]"><Skeleton className="h-3 w-24" /><Skeleton className="h-4 w-3/4" /></div>)}</div></SkeletonRegion>;
}
export function FormSkeleton({ label, fields = 3 }: { label: string; fields?: number }) {
  return <SkeletonRegion label={label}><div className="grid gap-4 sm:grid-cols-2">{Array.from({ length: fields }, (_, index) => <div key={index} className="space-y-2"><Skeleton className="h-3 w-28" /><Skeleton className="h-9 w-full" /></div>)}</div></SkeletonRegion>;
}
export function StatsSkeleton({ label, count = 4 }: { label: string; count?: number }) {
  return <SkeletonRegion label={label}><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: count }, (_, index) => <div key={index} className="space-y-3 rounded-xl border bg-card p-4"><Skeleton className="h-3 w-24" /><Skeleton className="h-6 w-32" /></div>)}</div></SkeletonRegion>;
}
export function ChartSkeleton({ label, count = 4 }: { label: string; count?: number }) {
  return <SkeletonRegion label={label}><div className="grid gap-4 lg:grid-cols-2">{Array.from({ length: count }, (_, index) => <div key={index} className="space-y-4 rounded-xl border bg-card p-4"><Skeleton className="h-5 w-40" /><div className="space-y-3">{Array.from({ length: 4 }, (_, row) => <div key={row} className="flex items-center gap-3"><Skeleton className="h-3 w-28" /><Skeleton className="h-3 flex-1" /><Skeleton className="h-3 w-16" /></div>)}</div></div>)}</div></SkeletonRegion>;
}
export function PreviewSkeleton({ label }: { label: string }) {
  return <SkeletonRegion label={label}><VisualTable rows={3} columns={3} /></SkeletonRegion>;
}
export function ReviewSkeleton({ label = "Loading request details" }: { label?: string }) {
  return <SkeletonRegion label={label}><div className="space-y-4"><Skeleton className="h-5 w-24 rounded-full" /><div className="grid gap-4 rounded-lg bg-muted/40 p-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <div key={index} className="space-y-2"><Skeleton className="h-3 w-20" /><Skeleton className="h-5 w-28" /></div>)}</div><div className="space-y-3">{Array.from({ length: 5 }, (_, index) => <div key={index} className="flex items-center justify-between gap-4"><Skeleton className="h-4 w-32" /><Skeleton className="h-4 w-40" /></div>)}</div><div className="space-y-2"><Skeleton className="h-5 w-40" /><VisualTable rows={4} columns={3} /></div></div></SkeletonRegion>;
}
export function TotalsSkeleton({ label, count = 5 }: { label: string; count?: number }) {
  return <SkeletonRegion label={label}><div className="grid gap-2 sm:grid-cols-5">{Array.from({ length: count }, (_, index) => <div key={index} className="space-y-2 rounded-lg border bg-muted/20 p-3"><Skeleton className="h-3 w-16" /><Skeleton className="h-5 w-24" /></div>)}</div></SkeletonRegion>;
}
export function VoucherEditorSkeleton({ label = "Loading voucher details" }: { label?: string }) {
  return <SkeletonRegion label={label}><div className="space-y-4"><div className="grid gap-3 rounded-lg bg-muted/30 p-4 sm:grid-cols-3">{Array.from({ length: 3 }, (_, index) => <div key={index} className="space-y-2"><Skeleton className="h-3 w-20" /><Skeleton className="h-4 w-32" /></div>)}</div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, index) => <div key={index} className="space-y-2"><Skeleton className="h-3 w-24" /><Skeleton className="h-9 w-full" /></div>)}</div><div className="space-y-3 rounded-lg border p-3"><Skeleton className="h-5 w-40" /><VisualTable rows={3} columns={6} /><div className="grid gap-2 sm:grid-cols-5">{Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-12 rounded-lg" />)}</div></div><div className="flex justify-end gap-2"><Skeleton className="h-9 w-24" /><Skeleton className="h-9 w-28" /><Skeleton className="h-9 w-32" /></div></div></SkeletonRegion>;
}
export function VoucherReviewSkeleton({ label = "Loading voucher review" }: { label?: string }) {
  return <SkeletonRegion label={label}><div className="space-y-4"><Skeleton className="h-5 w-24 rounded-full" /><div className="grid gap-4 rounded-lg bg-muted/30 p-4 sm:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <div key={index} className="space-y-2"><Skeleton className="h-3 w-20" /><Skeleton className="h-4 w-28" /></div>)}</div><div className="space-y-2"><Skeleton className="h-4 w-32" /><VisualTable rows={4} columns={6} /></div><div className="flex justify-end gap-2"><Skeleton className="h-9 w-20" /><Skeleton className="h-9 w-28" /></div></div></SkeletonRegion>;
}
export function PageSkeleton({ label, workspace = "" }: { label: string; workspace?: string }) {
  const onboarding = workspace === "onboarding", approval = workspace === "onboarding-approval", columns = approval ? 7 : 8;
  const tableCard = (key: number) => <div key={key} className="space-y-4 rounded-xl border p-4 md:p-5"><div className="flex flex-wrap items-center justify-between gap-3"><Skeleton className="h-5 w-36" /><Skeleton className="h-9 w-32" /></div><div className="overflow-hidden rounded-lg border"><div className="flex gap-3 bg-muted/40 p-3">{Array.from({ length: columns }, (_, index) => <Skeleton key={index} className="h-3 flex-1" />)}</div>{Array.from({ length: 5 }, (_, row) => <div key={row} className="flex gap-3 border-t p-3">{Array.from({ length: columns }, (_, index) => <Skeleton key={index} className="h-4 flex-1" />)}</div>)}</div></div>;
  return <SkeletonRegion label={label}><div className="space-y-5"><div className="space-y-3"><Skeleton className="h-7 w-48 max-w-full" /><Skeleton className="h-4 w-full max-w-2xl" /></div>{onboarding && <div className="flex gap-2 overflow-hidden">{[96, 80, 112, 96, 80].map((width, index) => <Skeleton key={index} className="h-9 shrink-0" style={{ width: `${width}px` }} />)}</div>}<div className="space-y-5">{approval ? [0, 1].map(tableCard) : tableCard(0)}</div></div></SkeletonRegion>;
}
export function AuditDetailSkeleton({ label = "Loading audit details" }: { label?: string }) {
  return <SkeletonRegion label={label}><div className="space-y-4"><div className="grid gap-3 sm:grid-cols-2">{Array.from({ length: 6 }, (_, index) => <div key={index} className="space-y-2"><Skeleton className="h-3 w-24" /><Skeleton className="h-4 w-3/4" /></div>)}</div><Skeleton className="h-40 w-full" /></div></SkeletonRegion>;
}
export function CsvSkeleton() {
  return <SkeletonRegion label="Preparing CSV"><div className="space-y-3"><div className="space-y-2 rounded border p-3">{Array.from({ length: 8 }, (_, index) => <Skeleton key={index} className="h-3" style={{ width: `${85 - (index % 4) * 10}%` }} />)}</div><div className="flex gap-2"><Skeleton className="h-9 w-28" /><Skeleton className="h-9 w-20" /></div></div></SkeletonRegion>;
}
