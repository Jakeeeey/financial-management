import type { AdjustingEntrySummary } from "../types";
import { ChevronDown } from "lucide-react";
import { balancedTolerance, money } from "./formatters";

type StatusTotal = readonly [string, number, string?];
type Props = {
  summary: AdjustingEntrySummary;
  selectedStatus?: string;
  onStatusSelect?: (status: string) => void;
  showPostedAmounts?: boolean;
  loading?: boolean;
  onShowPosted?: () => void;
  onInvestigatePosted?: () => void;
  onShowUnbalancedDrafts?: () => void;
};

export function AdjustingEntriesSummaryCards({ summary, selectedStatus = "All", onStatusSelect, showPostedAmounts = false, loading = false, onShowPosted, onInvestigatePosted, onShowUnbalancedDrafts }: Props) {
  const primary: readonly StatusTotal[] = [["Awaiting review", summary.submitted, "Submitted"],["Approved", summary.approved, "Approved"],["Posting failed", summary.failed, "Failed"],["Draft", summary.draft, "Draft"]];
  const secondary: readonly StatusTotal[] = [["Posted", summary.posted, "Posted"],["Rejected", summary.rejected, "Rejected"],["Cancelled", summary.cancelled, "Cancelled"],["Voided", summary.voided, "Voided"]];
  const cards = (values: readonly StatusTotal[]) => values.map(([label, value, status]) => {
    const selected = status === selectedStatus;
    const className = `rounded-md border bg-background px-3 py-2 text-left transition-colors ${onStatusSelect && status ? "cursor-pointer hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" : ""} ${selected && onStatusSelect && status ? "border-primary bg-primary/5" : ""}`;
    const content = <><p className="text-xs text-muted-foreground">{label}</p><p className="mt-0.5 text-lg font-semibold">{value || 0}</p></>;
    return onStatusSelect && status
      ? <button key={label} type="button" aria-pressed={selected} className={className} onClick={() => onStatusSelect(selected ? "All" : status)}>{content}</button>
      : <div key={label} className={className}>{content}</div>;
  });
  const postedDelta = Math.round((summary.postedDebit - summary.postedCredit) * 100) / 100;
  const postedImbalanced = Math.abs(postedDelta) > balancedTolerance;
  const postedSelected = selectedStatus === "Posted";
  const postedCardClass = `rounded-md border bg-background px-3 py-2 text-left transition-colors${onShowPosted ? " cursor-pointer hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" : ""}${postedSelected && onShowPosted ? " border-primary bg-primary/5" : ""}`;
  const postedContent = (label: string, value: number) => <><p className="text-xs text-muted-foreground">{label}</p><p className="mt-0.5 font-mono text-lg font-semibold">{money(value)}</p></>;
  const postedCards = onShowPosted
    ? <>
        <button type="button" aria-pressed={postedSelected} className={postedCardClass} onClick={onShowPosted}>{postedContent("Posted debits", summary.postedDebit)}</button>
        <button type="button" aria-pressed={postedSelected} className={postedCardClass} onClick={onShowPosted}>{postedContent("Posted credits", summary.postedCredit)}</button>
      </>
    : <>
        <div className={postedCardClass}>{postedContent("Posted debits", summary.postedDebit)}</div>
        <div className={postedCardClass}>{postedContent("Posted credits", summary.postedCredit)}</div>
      </>;

  if (loading && summary.totalRecords === 0) {
    return <section aria-label="Adjusting entry status totals" aria-busy="true" className="space-y-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="rounded-md border bg-background px-3 py-2"><div className="h-3 w-20 animate-pulse rounded bg-muted" /><div className="mt-1.5 h-5 w-10 animate-pulse rounded bg-muted" /></div>)}</div>
      {showPostedAmounts && <div className="grid grid-cols-2 gap-2">{Array.from({ length: 2 }).map((_, index) => <div key={index} className="rounded-md border bg-background px-3 py-2"><div className="h-3 w-24 animate-pulse rounded bg-muted" /><div className="mt-1.5 h-5 w-24 animate-pulse rounded bg-muted" /></div>)}</div>}
    </section>;
  }

  return <section aria-label="Adjusting entry status totals" className="space-y-2">
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{cards(primary)}</div>
    {summary.imbalanced > 0 && <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm">
      <p className="text-amber-800">{summary.imbalanced} unbalanced draft{summary.imbalanced === 1 ? "" : "s"} cannot be submitted.</p>
      {onShowUnbalancedDrafts && <button type="button" className="font-semibold text-amber-800 underline underline-offset-2 hover:text-amber-900" onClick={onShowUnbalancedDrafts}>Show drafts</button>}
    </div>}
    {showPostedAmounts && <div className="grid grid-cols-2 gap-2" aria-label="Posted debit and credit totals">{postedCards}</div>}
    {showPostedAmounts && postedImbalanced && <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm">
      <p className="text-red-700">Posted journals are out of balance: {postedDelta > 0 ? "debits exceed credits" : "credits exceed debits"} by {money(Math.abs(postedDelta))}.</p>
      {onInvestigatePosted && <button type="button" className="font-semibold text-red-700 underline underline-offset-2 hover:text-red-800" onClick={onInvestigatePosted}>Investigate</button>}
    </div>}
    {onStatusSelect && <p className="text-xs text-muted-foreground">Select a status count to filter the journal list. Counts include every status.</p>}
    <details className="group">
      <summary className="flex cursor-pointer list-none items-center gap-1 py-1 text-xs text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
        <ChevronDown className="size-3 transition-transform group-open:rotate-180" /> More status totals
      </summary>
      <div className="grid grid-cols-2 gap-2 pt-1 sm:grid-cols-4">{cards(secondary)}</div>
    </details>
  </section>;
}
