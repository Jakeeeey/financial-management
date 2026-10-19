import type { AdjustingEntrySummary } from "../types";
export function AdjustingEntriesSummaryCards({ summary }: { summary: AdjustingEntrySummary }) {
  const values = [["Draft", summary.draft],["Awaiting review", summary.submitted],["Approved", summary.approved],["Posted", summary.posted],["Rejected", summary.rejected],["Cancelled", summary.cancelled],["Posting failed", summary.failed],["Unbalanced drafts", summary.imbalanced]] as const;
  return <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{values.map(([label,value]) => <div key={label} className="rounded-md border bg-background p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-xl font-semibold">{value || 0}</p></div>)}</div>;
}
