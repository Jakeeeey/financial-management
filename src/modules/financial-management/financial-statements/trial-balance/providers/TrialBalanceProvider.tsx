"use client";

import * as React from "react";
import {
  TrialBalanceItem,
  TrialBalanceFilterState,
  TrialBalanceSummaryData,
} from "../types/trial-balance.schema";
import { toast } from "sonner";

interface TrialBalanceContextType {
  // Data
  items: TrialBalanceItem[];
  summary: TrialBalanceSummaryData;

  // State
  filters: TrialBalanceFilterState;
  setFilters: React.Dispatch<React.SetStateAction<TrialBalanceFilterState>>;
  isLoading: boolean;
  error: string | null;

  // Actions
  refresh: () => Promise<void>;
  resetFilters: () => void;
}

const DEFAULT_FILTERS: TrialBalanceFilterState = {
  search: "",
  startDate: "2025-01-01",
  endDate: "2025-12-30",
  periodType: "manual",
  status: "all",
  accountCategory: "all",
  reviewFlag: "all",
  sourceModule: [],
  divisionName: "",
  departmentName: "",
  postedOnly: false,
};

const TrialBalanceContext = React.createContext<TrialBalanceContextType | undefined>(undefined);

export function TrialBalanceProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<TrialBalanceItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [filters, setFilters] = React.useState<TrialBalanceFilterState>(DEFAULT_FILTERS);

  const fetchData = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Build query string for the local proxy
      const query = new URLSearchParams();
      query.set("startDate", filters.startDate);
      query.set("endDate", filters.endDate);

      if (filters.status !== "all") {
        query.set("status", filters.status);
      }
      if (filters.accountCategory !== "all") {
        query.set("accountCategory", filters.accountCategory);
      }
      if (filters.reviewFlag !== "all") {
        query.set("reviewFlag", filters.reviewFlag);
      }
      if (filters.search) {
        query.set("search", filters.search);
      }
      if (filters.divisionName) {
        query.set("divisionName", filters.divisionName);
      }
      if (filters.departmentName) {
        query.set("departmentName", filters.departmentName);
      }
      if (filters.postedOnly) {
        query.set("postedOnly", "true");
      }
      if (filters.sourceModule.length > 0) {
        for (const mod of filters.sourceModule) {
          query.append("sourceModule", mod);
        }
      }

      const url = `/api/fm/financial-statements/trial-balance?${query.toString()}`;
      const res = await fetch(url);

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to fetch trial balance");
      }

      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      console.error("Trial Balance Fetch Error:", e);
      setError(message);
      toast.error(`Database Error: ${message}`);
    } finally {
      setIsLoading(false);
    }
  }, [
    filters.startDate,
    filters.endDate,
    filters.status,
    filters.accountCategory,
    filters.reviewFlag,
    filters.search,
    filters.divisionName,
    filters.departmentName,
    filters.postedOnly,
    filters.sourceModule,
  ]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Derived: Aggregated summary data for dashboard cards
  const summary: TrialBalanceSummaryData = React.useMemo(() => {
    const totalDebit = items.reduce((sum, item) => sum + item.totalDebit, 0);
    const totalCredit = items.reduce((sum, item) => sum + item.totalCredit, 0);
    const difference = Math.abs(totalDebit - totalCredit);

    return {
      totalDebit,
      totalCredit,
      difference,
      accountCount: items.length,
      isBalanced: difference === 0,
    };
  }, [items]);

  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS);
  };

  const value: TrialBalanceContextType = {
    items,
    summary,
    filters,
    setFilters,
    isLoading,
    error,
    refresh: fetchData,
    resetFilters,
  };

  return (
    <TrialBalanceContext.Provider value={value}>
      {children}
    </TrialBalanceContext.Provider>
  );
}

export function useTrialBalanceContext() {
  const context = React.useContext(TrialBalanceContext);
  if (context === undefined) {
    throw new Error("useTrialBalanceContext must be used within a TrialBalanceProvider");
  }
  return context;
}
