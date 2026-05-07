"use client";

import React, { createContext, useContext } from "react";
import { useBudgetApproval } from "../hooks/useBudgetApproval";
import type { BudgetApprovalFilters, Budget } from "../types";

interface BudgetApprovalContextValue {
  // Data & state
  displayedItems:  Budget[];
  loading:         boolean;
  initialLoading:  boolean;
  hasMore:         boolean;
  total:           number;
  // Infinite scroll
  loadMore:        () => void;
  // Filters
  filters:         BudgetApprovalFilters;
  updateFilter:    <K extends keyof BudgetApprovalFilters>(key: K, value: BudgetApprovalFilters[K]) => void;
  clearFilters:    () => void;
  hasFilters:      boolean;
  // Selection
  selectedIds:     Set<string>;
  toggleSelect:    (id: string) => void;
  toggleSelectAll: () => void;
  clearSelection:  () => void;
  // Actions
  approveBudget:   (id: string) => void;
  rejectBudget:    (id: string) => void;
  bulkApprove:     () => void;
  bulkReject:      () => void;
}

const BudgetApprovalContext = createContext<BudgetApprovalContextValue | null>(null);

export function BudgetApprovalProvider({ children }: { children: React.ReactNode }) {
  const budgets = useBudgetApproval();

  return (
    <BudgetApprovalContext.Provider value={budgets}>
      {children}
    </BudgetApprovalContext.Provider>
  );
}

export function useBudgetApprovalContext(): BudgetApprovalContextValue {
  const ctx = useContext(BudgetApprovalContext);
  if (!ctx) throw new Error("useBudgetApprovalContext must be used within BudgetApprovalProvider");
  return ctx;
}
