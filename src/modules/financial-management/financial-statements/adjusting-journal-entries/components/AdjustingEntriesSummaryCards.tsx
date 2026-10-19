import type { AdjustingEntrySummary } from "../types";
import { ChevronDown } from "lucide-react";
import { money } from "./formatters";

type StatusTotal = readonly [string, number, string?];
type Props = {
  summary: AdjustingEntrySummary;
  selectedStatus?: string;
  onStatusSelect?: (status: string) => void;
  showPostedAmounts?: boolean;
};

export function AdjustingEntriesSummaryCards({ summary, selectedStatus = "All", onStatusSelect, showPostedAmounts = false }: Props) {
  const primary: readonly StatusTotal[] = [["Awaiting review", summary.submitted, "Submitted"],["Approved", summary.approved, "Approved"],["Posting failed", summary.failed, "Failed"],["Draft", summary.draft, "Draft"]];
  const secondary: readonly StatusTotal[] = [["Posted", summary.posted, "Posted"],["Rejected", summary.rejected, "Rejected"],["Cancelled", summary.cancelled, "Cancelled"],["Voided", summary.voided, "Voided"],["Unbalanced drafts", summary.imbalanced]];
  const cards = (values: readonly StatusTotal[]) => values.map(([label, value, status]) => {
    const selected = status === selectedStatus;
    const className = `rounded-md border bg-background px-3 py-2 text-left transition-colors ${onStatusSelect && status ? "cursor-pointer hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" : ""} ${selected && onStatusSelect && status ? "border-primary bg-primary/5" : ""}`;
    const content = <><p className="text-xs text-muted-foreground">{label}</p><p className="mt-0.5 text-lg font-semibold">{value || 0}</p></>;
    return onStatusSelect && status
      ? <button key={label} type="button" aria-pressed={selected} className={className} onClick={() => onStatusSelect(selected ? "All" : status)}>{content}</button>
      : <div key={label} className={className}>{content}</div>;
  });
  return <section aria-label="Adjusting entry status totals" className="space-y-2">
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{cards(primary)}</div>
    {showPostedAmounts && <div className="grid grid-cols-2 gap-2" aria-label="Posted debit and credit totals">
      <div className="rounded-md border bg-background px-3 py-2"><p className="text-xs text-muted-foreground">Posted debits</p><p className="mt-0.5 font-mono text-lg font-semibold">{money(summary.postedDebit)}</p></div>
      <div className="rounded-md border bg-background px-3 py-2"><p className="text-xs text-muted-foreground">Posted credits</p><p className="mt-0.5 font-mono text-lg font-semibold">{money(summary.postedCredit)}</p></div>
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
