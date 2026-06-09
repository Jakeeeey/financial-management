"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { toast } from "sonner";
import {
  CashFlowEntry,
  CashFlowFilterState,
  GroupedCashFlowEntries,
} from "../types/cash-flow.schema";
import {
  getCashFlowStatement,
  groupCashFlowEntries,
  calculateCashFlowSummary,
} from "../services/cash-flow.service";

export function useCashFlowStatement() {
  const today = new Date().toISOString().split("T")[0];
  const firstDayOfMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1
  ).toISOString().split("T")[0];

  // Filter state
  const [filters, setFilters] = useState<CashFlowFilterState>({
    startDate: firstDayOfMonth,
    endDate: today,
    cashFlowActivity: "All",
  });

  // Data state — entries reference stays stable via ref
  const [entries, setEntries] = useState<CashFlowEntry[]>([]);
  const entriesRef = useRef(entries);
  entriesRef.current = entries;

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  // Fetch cash flow data
  const fetchData = useCallback(async () => {
    const currentFilters = filtersRef.current;
    if (!currentFilters.startDate || !currentFilters.endDate) {
      setError("Please select both start and end dates");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await getCashFlowStatement({
        startDate: currentFilters.startDate,
        endDate: currentFilters.endDate,
        cashFlowActivity:
          currentFilters.cashFlowActivity === "All" ? undefined : currentFilters.cashFlowActivity,
      });

      setEntries(data);
      toast.success("Cash flow statement loaded successfully");
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load cash flow statement";
      setError(errorMessage);
      toast.error(errorMessage);
      setEntries([]);
    } finally {
      setIsLoading(false);
    }
  }, []); // Stable reference — never recreates

  // Auto-fetch when filters change (with debounce for date inputs)
  useEffect(() => {
    if (filters.startDate && filters.endDate) {
      const timer = setTimeout(() => {
        fetchData();
      }, 500); // 500ms debounce

      return () => clearTimeout(timer);
    }
  }, [filters, fetchData]);

  // Grouped entries for display
  const groupedEntries = useMemo<GroupedCashFlowEntries>(() => {
    return groupCashFlowEntries(entries);
  }, [entries]);

  // Summary calculations
  const summary = useMemo(
    () => calculateCashFlowSummary(entries),
    [entries]
  );

  // Handlers
  const updateFilters = useCallback(
    (updates: Partial<CashFlowFilterState>) => {
      setFilters((prev) => ({ ...prev, ...updates }));
    },
    []
  );

  const setStartDate = useCallback((date: string) => {
    setFilters((prev) => ({ ...prev, startDate: date }));
  }, []);

  const setEndDate = useCallback((date: string) => {
    setFilters((prev) => ({ ...prev, endDate: date }));
  }, []);

  const setCashFlowActivity = useCallback((activity: string) => {
    setFilters((prev) => ({ ...prev, cashFlowActivity: activity }));
  }, []);

  const refresh = useCallback(() => {
    fetchData();
  }, [fetchData]);

  return {
    // State
    entries,
    groupedEntries,
    summary,
    isLoading,
    error,
    filters,

    // Actions
    setStartDate,
    setEndDate,
    setCashFlowActivity,
    updateFilters,
    refresh,
  };
}