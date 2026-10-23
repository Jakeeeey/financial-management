"use client";

import { useBalanceSheetContext } from "../providers/BalanceSheetProvider";

/**
 * Standardized client-side hook for accessing balance sheet data and state.
 * Abstracts the underlying provider and provides a clean interface for UI components.
 */
export function useBalanceSheet() {
  const context = useBalanceSheetContext();

  return {
    // Derived data for UI
    accounts: context.accounts,
    validation: context.validation,
    ratios: context.ratios,

    // Raw API data (if needed)
    entries: context.entries,
    comparisonEntries: context.comparisonEntries,
    summary: context.summary,
    comparisonSummary: context.comparisonSummary,
    comparisonStatus: context.comparisonStatus,

    // State
    filters: context.filters,
    appliedFilters: context.appliedFilters,
    setFilters: context.setFilters,
    isLoading: context.isLoading,
    reportStatus: context.reportStatus,
    lastUpdated: context.lastUpdated,
    error: context.error,

    // Actions
    refresh: context.refresh,
    resetFilters: context.resetFilters,
  };
}
