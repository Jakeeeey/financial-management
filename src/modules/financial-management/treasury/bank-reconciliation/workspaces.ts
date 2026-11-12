export const BANK_RECONCILIATION_ROOT = "/fm/treasury/bank-reconciliation";

export const BANK_RECONCILIATION_WORKSPACES = {
  reconcile: {
    title: "Reconcile",
    description: "Match bank statement transactions to the Cash in Bank ledger and review reconciliation differences.",
  },
  posting: {
    title: "Posting",
    description: "Review and post reconciliation adjustments, then close the reconciled period.",
  },
  reports: {
    title: "Reports",
    description: "View reconciliation statements, outstanding items, adjusting entries, audit history, and closed periods.",
  },
} as const;

export type BankReconciliationWorkspaceKey = keyof typeof BANK_RECONCILIATION_WORKSPACES;
export type BankReconciliationSearchParams = Record<string, string | string[] | undefined>;

export function bankReconciliationLandingPath(searchParams: BankReconciliationSearchParams) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) value.forEach(item => query.append(key, item));
    else if (value !== undefined) query.append(key, value);
  }
  const suffix = query.toString();
  return `${BANK_RECONCILIATION_ROOT}/reconcile${suffix ? `?${suffix}` : ""}`;
}
