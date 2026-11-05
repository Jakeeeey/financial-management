import { varianceCoaLabels, type VarianceCoaAccount } from "../utils/variance-coa-labels";
import type { ExpenseVariance } from "../utils/budget-balances";

const money = (value: number) => `PHP ${value.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function ExpenseVarianceSummary({ variance, accounts = [] }: { variance: ExpenseVariance; accounts?: readonly VarianceCoaAccount[] }) {
  const labels = varianceCoaLabels(accounts);
  return <section aria-label="Audit Variance Summary" className="min-w-0 space-y-2 rounded-lg border border-amber-300 bg-amber-50/30 p-3 text-sm">
    <h4 className="font-semibold">Audit Variance Summary</h4>
    <p>Total allocated: {money(variance.allocatedAmount)} | Current submission actual: {money(variance.actualAmount)}</p>
    <p>Other pending / recorded expenses: {money(variance.otherCommittedAmount)} | Projected cumulative actual: {money(variance.projectedActualAmount)}</p>
    <p>Net variance: {variance.netVariance > 0 ? "+" : ""}{money(variance.netVariance)} ({variance.netVariance > 0 ? "Over Budget" : variance.netVariance < 0 ? "Under Allocation" : "Within Allocation"})</p>
    <p className="text-xs text-muted-foreground">Compared against allocation, not cash received. This does not establish a reimbursement or refund.</p>
    {variance.byCoa.map((row) => <p key={row.coaId} className="text-xs [overflow-wrap:anywhere]">{labels.get(row.coaId) || `COA ${row.coaId} (name unavailable)`}: allocated {money(row.allocatedAmount)}, other committed {money(row.otherCommittedAmount)}, current {money(row.requestedAmount)}, projected {money(row.projectedAmount)}, overage {money(row.overAmount)}{row.unbudgeted ? " | Unbudgeted" : ""}</p>)}
    {variance.requiresAcknowledgment && <p role="status" className="font-medium text-amber-800">Variance Warning: submission is allowed. Approval requires acknowledgment and a reason.</p>}
  </section>;
}
