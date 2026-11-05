export const FINANCIAL_PERFORMANCE_SOURCE_MODULES = [
  "Sales",
  "Sales Invoice",
  "Disbursement",
  "Collection",
] as const;

export function describeFinancialPerformanceStatus(status: string): string {
  const normalizedStatus = status.trim().toLowerCase();

  if (!normalizedStatus || normalizedStatus === "all") {
    return "All transaction statuses";
  }

  if (normalizedStatus === "posted") {
    return "Posted (includes Sales Invoice entries marked Dispatched)";
  }

  return status;
}
