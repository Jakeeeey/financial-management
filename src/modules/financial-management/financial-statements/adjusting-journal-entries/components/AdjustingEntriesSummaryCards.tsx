import type { AdjustingEntrySummary } from "../types";
import { ChevronDown } from "lucide-react";
import { money } from "./formatters";

type StatusTotal = readonly [string, number];
type Props = {
  summary: AdjustingEntrySummary;
  showPostedAmounts?: boolean;
  loading?: boolean;
  onInvestigatePosted?: () => void;
  onShowUnbalancedDrafts?: () => void;
};

function toCentavos(value: number) {
  return Math.round((value + Math.sign(value) * Number.EPSILON) * 100);
}

export function AdjustingEntriesSummaryCards({ summary, showPostedAmounts = false, loading = false, onInvestigatePosted, onShowUnbalancedDrafts }: Props) {
  const statuses: readonly StatusTotal[] = [
    ["Awaiting posting", summary.submitted],
    ["For Revision", summary.forRevision],
    ["Posting failed", summary.failed],
    ["Draft", summary.draft],
    ["Cancelled", summary.cancelled],
    ["Voided", summary.voided],
  ];
  const postedDifference = (toCentavos(summary.postedDebit) - toCentavos(summary.postedCredit)) / 100;
  const metricClassName = "min-w-0 rounded-md border bg-background px-3 py-2";
  const metricValueClassName = "mt-0.5 break-words font-mono text-base font-semibold tabular-nums sm:text-lg";
  const statusCards = statuses.map(([label, value]) => <div key={label} className={metricClassName}><p className="text-xs text-muted-foreground">{label}</p><p className="mt-0.5 text-lg font-semibold">{value || 0}</p></div>);

  if (loading && summary.totalRecords === 0) {
    const skeletonGrid = <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
      {Array.from({ length: 5 }).map((_, index) => <div key={index} className={`rounded-md border bg-background px-3 py-2 ${index === 4 ? "col-span-2 sm:col-span-1" : ""}`}><div className="h-3 w-24 animate-pulse rounded bg-muted" /><div className="mt-1.5 h-5 w-28 animate-pulse rounded bg-muted" /></div>)}
    </div>;
    return <section aria-label="Adjusting entry reporting metrics" aria-busy="true" className="space-y-3">
      <details className="group rounded-md border bg-background px-3 sm:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 py-2 text-sm font-medium [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-2"><ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />Report overview</span>
          <span className="text-xs font-normal text-muted-foreground">Loading metrics…</span>
        </summary>
        <div className="border-t py-3">{skeletonGrid}</div>
      </details>
      <div className="hidden sm:block">{skeletonGrid}</div>
    </section>;
  }

  const metrics = <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
      <div className={metricClassName}><p className="text-xs text-muted-foreground">Total entries</p><p className="mt-0.5 text-lg font-semibold">{summary.totalRecords}</p><p className="text-xs text-muted-foreground">Across all workflow statuses</p></div>
      <div className={metricClassName}><p className="text-xs text-muted-foreground">Posted entries</p><p className="mt-0.5 text-lg font-semibold">{summary.posted}</p></div>
      {showPostedAmounts && <>
        <div className={metricClassName}><p className="text-xs text-muted-foreground">Posted debits</p><p className={metricValueClassName}>{money(summary.postedDebit)}</p></div>
        <div className={metricClassName}><p className="text-xs text-muted-foreground">Posted credits</p><p className={metricValueClassName}>{money(summary.postedCredit)}</p></div>
        <div className={`${metricClassName} col-span-2 sm:col-span-1`}><p className="text-xs text-muted-foreground">Posted debit–credit difference</p><p className={metricValueClassName}>{money(postedDifference)}</p><p className="text-xs text-muted-foreground">Debits minus credits; negative means credits exceed debits.</p></div>
      </>}
    </div>;

  return <section aria-label="Adjusting entry reporting metrics" className="space-y-3">
    <details className="group rounded-md border bg-background px-3 sm:hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 py-2 text-sm font-medium [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2"><ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />Report overview</span>
        <span className="text-xs font-normal text-muted-foreground">{showPostedAmounts ? "5 metrics" : "2 metrics"}</span>
      </summary>
      <div className="border-t py-3">{metrics}</div>
    </details>
    <div className="hidden sm:block">{metrics}</div>
    <details className="group rounded-md border bg-background px-3">
      <summary className="flex cursor-pointer list-none items-center gap-2 py-2 text-sm font-medium hover:text-foreground [&::-webkit-details-marker]:hidden">
        <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" /> Workflow details and review flags
      </summary>
      <div className="space-y-3 border-t py-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{statusCards}</div>
        {summary.imbalanced > 0 && <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm">
          <p className="text-amber-800">{summary.imbalanced} unbalanced draft or revision{summary.imbalanced === 1 ? "" : "s"} cannot be submitted.</p>
          {onShowUnbalancedDrafts && <button type="button" className="font-semibold text-amber-800 underline underline-offset-2 hover:text-amber-900" onClick={onShowUnbalancedDrafts}>Show unbalanced draft or revisions</button>}
        </div>}
        {showPostedAmounts && summary.postedImbalanced > 0 && <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm">
          <p className="text-red-700">{summary.postedImbalanced} posted journal{summary.postedImbalanced === 1 ? " is" : "s are"} individually out of balance.</p>
          {onInvestigatePosted && <button type="button" className="font-semibold text-red-700 underline underline-offset-2 hover:text-red-800" onClick={onInvestigatePosted}>Investigate unbalanced posted journals</button>}
        </div>}
      </div>
    </details>
  </section>;
}
