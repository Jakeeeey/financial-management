import type { FinancialPerformanceEntry } from "../types";

export const FINANCIAL_PERFORMANCE_ACCOUNT_BREAKDOWN_SECTIONS = [
  "Sales",
  "Purchases / Cost of Sales",
  "Operating Expenses",
  "Other Income",
  "Other Expense",
] as const;

export function isFinancialPerformanceAccountBreakdownEntry(entry: FinancialPerformanceEntry): boolean {
  return FINANCIAL_PERFORMANCE_ACCOUNT_BREAKDOWN_SECTIONS.some(section => section === entry.reportSection);
}

export function matchesFinancialPerformanceEntrySearch(
  entry: FinancialPerformanceEntry,
  searchQuery: string,
): boolean {
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  if (!normalizedSearchQuery) return true;

  return [
    entry.glCode,
    entry.accountTitle,
    entry.reportSection,
    entry.division,
    entry.department,
  ].some(value => (value ?? "").toLowerCase().includes(normalizedSearchQuery));
}
