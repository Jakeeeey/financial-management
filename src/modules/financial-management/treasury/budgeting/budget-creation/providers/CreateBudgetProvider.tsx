// src/modules/financial-management/treasury/budgeting/budget-creation/providers/CreateBudgetProvider.tsx

"use client";

import React, { createContext, useContext, useState } from "react";
import { useCreateBudgets } from "../hooks/useCreateBudgets";
import type { CreateBudgetPayload, BudgetFilters, Budget } from "../types";

interface CreateBudgetContextValue {
  // Data & state
  displayedItems:  Budget[];
  budgets:         Budget[];
  kpiTotals:       { draft: number; pending: number; approved: number; rejected: number };
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
  submitBudgets:     (ids: string[]) => Promise<void>;
  submitForApproval: (id: string | number) => void;
  quickSubmit:       () => void;
  quickDelete:       () => void;
  addBudget:         (payload: CreateBudgetPayload, names?: { division_name?: string; department_name?: string; coa_name?: string }) => Promise<void>;
  updateBudget:      (id: string, payload: Partial<CreateBudgetPayload>, names?: { division_name?: string; department_name?: string; coa_name?: string }) => Promise<void>;
  deleteBudget:      (id: string | number) => void;
  isDuplicate:       (year: number, month: number, coaId: number, divisionId: number, departmentId: number, excludeId?: string) => Promise<boolean>;
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

  const { budgets, ...budgetMethods } = useCreateBudgets();

  const value: CreateBudgetContextValue = {
    ...budgetMethods,
    quickDelete: budgetMethods.deleteSelected,
    displayedItems: budgets,
    budgets,
    initialLoading: false, // For now, we use loading from hook
    hasMore: false,        // Pagination to be implemented
    total: budgets.length,
    loadMore: () => {},
    updateFilter: (key, val) => {
        budgetMethods.setFilters(prev => ({ ...prev, [key]: val }));
    },
    clearFilters: () => {
        budgetMethods.setFilters({
            search: "",
            year: String(new Date().getFullYear()),
            month: String(new Date().getMonth() + 1),
            division_id: "",
            department_id: "",
            status: "Draft",
        });
    },
    hasFilters: budgetMethods.filters.search !== "" || budgetMethods.filters.month !== "" || budgetMethods.filters.division_id !== "",
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
