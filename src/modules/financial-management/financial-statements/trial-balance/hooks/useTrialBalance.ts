"use client";

import { useTrialBalanceContext } from "../providers/TrialBalanceProvider";

/**
 * Standardized client-side hook for accessing trial balance data and state.
 * Abstracts the underlying provider and provides a clean interface for UI components.
 */
export function useTrialBalance() {
  return useTrialBalanceContext();
}
