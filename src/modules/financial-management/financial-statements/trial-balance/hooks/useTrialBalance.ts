"use client";

import { useTrialBalanceContext } from "../providers/TrialBalanceProvider";

/**
 * Standardized client-side hook for accessing trial balance data and state.
 * Abstracts the underlying provider and provides a clean interface for UI components.
 */
export function useTrialBalance() {
  const context = useTrialBalanceContext();

  return {
    // Data
    items: context.items,
    summary: context.summary,

    // State
    filters: context.filters,
    setFilters: context.setFilters,
    isLoading: context.isLoading,
    error: context.error,

    // Actions
    refresh: context.refresh,
    resetFilters: context.resetFilters,
  };
}
