// src/modules/financial-management/treasury/budgeting/create-budget/providers/CreateBudgetProvider.tsx

"use client";

import React, { createContext, useContext, useState } from "react";
import { useCreateBudgets } from "../hooks/useCreateBudgets";
import type { CreateBudgetPayload, BudgetFilters, Budget } from "../types";

interface CreateBudgetContextValue {
  // Data & state
  displayedItems:  Budget[];
  loading:         boolean;
  initialLoading:  boolean;
  hasMore:         boolean;
  total:           number;
  // Infinite scroll
  loadMore:        () => void;
  // Filters
  filters:         BudgetFilters;
  updateFilter:    <K extends keyof BudgetFilters>(key: K, value: BudgetFilters[K]) => void;
  clearFilters:    () => void;
  hasFilters:      boolean;
  // Selection
  selectedIds:     Set<string>;
  toggleSelect:    (id: string) => void;
  toggleSelectAll: () => void;
  clearSelection:  () => void;
  // Actions
  submitForApproval: (id: string) => void;
  quickSubmit:       () => void;
  addBudget:         (payload: CreateBudgetPayload, names?: { division_name?: string; department_name?: string; coa_name?: string }) => void;
  updateBudget:      (id: string, payload: CreateBudgetPayload, names?: { division_name?: string; department_name?: string; coa_name?: string }) => void;
  deleteBudget:      (id: string) => void;
  isDuplicate:       (year: number, month: number, deptDivCoaId: number, excludeId?: string) => boolean;
  // Modal
  isModalOpen:     boolean;
  editingBudget:   Budget | null;
  supplementParent: Budget | null;
  openModal:       () => void;
  openEditModal:   (budget: Budget) => void;
  openSupplementModal: (budget: Budget) => void;
  closeModal:      () => void;
  // Helpers
  getGrandTotal:   (budgetId: string) => number;
  hasInFlightSupplement: (parentId: string) => boolean;
}

const CreateBudgetContext = createContext<CreateBudgetContextValue | null>(null);

export function CreateBudgetProvider({ children }: { children: React.ReactNode }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [supplementParent, setSupplementParent] = useState<Budget | null>(null);

  const budgets = useCreateBudgets();

  const value: CreateBudgetContextValue = {
    ...budgets,
    isModalOpen,
    editingBudget,
    supplementParent,
    openModal:  () => {
        setEditingBudget(null);
        setSupplementParent(null);
        setIsModalOpen(true);
    },
    openEditModal: (budget: Budget) => {
        setEditingBudget(budget);
        setSupplementParent(null);
        setIsModalOpen(true);
    },
    openSupplementModal: (budget: Budget) => {
        setEditingBudget(null);
        setSupplementParent(budget);
        setIsModalOpen(true);
    },
    closeModal: () => {
        setIsModalOpen(false);
        setEditingBudget(null);
        setSupplementParent(null);
    },
  };

  return (
    <CreateBudgetContext.Provider value={value}>
      {children}
    </CreateBudgetContext.Provider>
  );
}

export function useCreateBudgetContext(): CreateBudgetContextValue {
  const ctx = useContext(CreateBudgetContext);
  if (!ctx) throw new Error("useCreateBudgetContext must be used within CreateBudgetProvider");
  return ctx;
}
