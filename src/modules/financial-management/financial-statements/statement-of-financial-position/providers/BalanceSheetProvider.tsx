"use client";

import * as React from "react";
import {
  BalanceSheetEntry,
  BalanceSheetSummary,
  BalanceSheetFilterState,
} from "../types/balance-sheet.schema";
import { FinancialAccount, ValidationStatus, KeyRatios } from "../types";
import { toast } from "sonner";

interface BalanceSheetContextType {
  // Raw API data
  entries: BalanceSheetEntry[];
  comparisonEntries: BalanceSheetEntry[];
  summary: BalanceSheetSummary | null;
  comparisonSummary: BalanceSheetSummary | null;

  // Derived data for the UI components
  accounts: FinancialAccount[];
  validation: ValidationStatus;
  ratios: KeyRatios;

  // State
  filters: BalanceSheetFilterState;
  setFilters: React.Dispatch<React.SetStateAction<BalanceSheetFilterState>>;
  isLoading: boolean;
  error: string | null;

  // Actions
  refresh: () => Promise<void>;
  resetFilters: () => void;
}

const DEFAULT_FILTERS: BalanceSheetFilterState = {
  startDate: "2026-01-01",
  endDate: "2026-12-31",
  status: "Posted",
  includeComparison: true,
  divisionName: "",
  departmentName: "",
  comparisonStartDate: "2025-01-01",
  comparisonEndDate: "2025-12-31",
  dataBasis: "annually",
  comparisonBasis: "match",
};

const EMPTY_SUMMARY: BalanceSheetSummary = {
  totalAssets: 0,
  totalLiabilities: 0,
  totalEquity: 0,
  balanceVariance: 0,
  currentRatio: 0,
  quickRatio: 0,
  debtToEquityRatio: 0,
  debtRatio: 0,
};

const EMPTY_VALIDATION: ValidationStatus = {
  totalAssets: 0,
  totalLiabilities: 0,
  totalEquity: 0,
  variance: 0,
  isBalanced: true,
};

const EMPTY_RATIOS: KeyRatios = {
  currentRatio: { current: 0, prior: 0, variance: 0 },
  quickRatio: { current: 0, prior: 0, variance: 0 },
  debtToEquity: { current: 0, prior: 0, variance: 0 },
  debtRatio: { current: 0, prior: 0, variance: 0 },
};

const BalanceSheetContext = React.createContext<BalanceSheetContextType | undefined>(undefined);

export function BalanceSheetProvider({ children }: { children: React.ReactNode }) {
  const [entries, setEntries] = React.useState<BalanceSheetEntry[]>([]);
  const [comparisonEntries, setComparisonEntries] = React.useState<BalanceSheetEntry[]>([]);
  const [summary, setSummary] = React.useState<BalanceSheetSummary | null>(null);
  const [comparisonSummary, setComparisonSummary] = React.useState<BalanceSheetSummary | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [filters, setFilters] = React.useState<BalanceSheetFilterState>(DEFAULT_FILTERS);

  const filtersRef = React.useRef(filters);
  React.useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  const fetchData = React.useCallback(async (overrideFilters?: BalanceSheetFilterState) => {
    const currentFilters = overrideFilters || filtersRef.current;
    setIsLoading(true);
    setError(null);

    try {
      const query = new URLSearchParams();
      query.set("startDate", currentFilters.startDate);
      query.set("endDate", currentFilters.endDate);

      if (currentFilters.status) {
        query.set("status", currentFilters.status);
      }
      if (currentFilters.includeComparison) {
        query.set("includeComparison", "true");
        if (currentFilters.comparisonStartDate) {
          query.set("comparisonStartDate", currentFilters.comparisonStartDate);
        }
        if (currentFilters.comparisonEndDate) {
          query.set("comparisonEndDate", currentFilters.comparisonEndDate);
        }
      }
      if (currentFilters.divisionName) {
        query.set("divisionName", currentFilters.divisionName);
      }
      if (currentFilters.departmentName) {
        query.set("departmentName", currentFilters.departmentName);
      }

      // Add cache-busting timestamp
      const url = `/api/fm/financial-statements/balance-sheet?${query.toString()}&t=${Date.now()}`;
      console.log("Fetching Balance Sheet:", url);
      const res = await fetch(url);

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to fetch balance sheet");
      }

      const data = await res.json();

      const safeAbs = (num: any) => (typeof num === "number" ? Math.abs(num) : 0);
      
      const normalizeEntries = (entries: any[]) => 
        entries.map(e => ({ ...e, amount: safeAbs(e.amount) }));
        
      const normalizeSummary = (s: any) => {
        if (!s) return null;
        let variance = safeAbs(s.totalAssets) - (safeAbs(s.totalLiabilities) + safeAbs(s.totalEquity));
        // Handle floating point precision issues
        variance = Math.round(variance * 100) / 100;
        
        return {
          ...s,
          totalAssets: safeAbs(s.totalAssets),
          totalLiabilities: safeAbs(s.totalLiabilities),
          totalEquity: safeAbs(s.totalEquity),
          balanceVariance: variance
        };
      };

      setEntries(Array.isArray(data.entries) ? normalizeEntries(data.entries) : []);
      setComparisonEntries(Array.isArray(data.comparisonEntries) ? normalizeEntries(data.comparisonEntries) : []);
      setSummary(normalizeSummary(data.summary));
      setComparisonSummary(normalizeSummary(data.comparisonSummary));
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      console.error("Balance Sheet Fetch Error:", e);
      setError(message);
      toast.error(`Database Error: ${message}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Derived: Map entries → FinancialAccount[] for the interactive table ───
  const accounts: FinancialAccount[] = React.useMemo(() => {
    // Build a lookup of comparison amounts by glCode
    const comparisonMap = new Map<string, number>();
    for (const ce of comparisonEntries) {
      comparisonMap.set(ce.glCode, ce.amount);
    }

    return entries.map((entry, index) => {
      const priorAmount = comparisonMap.get(entry.glCode) ?? 0;
      const variance = entry.amount - priorAmount;
      const variancePercentage = priorAmount !== 0
        ? ((variance / Math.abs(priorAmount)) * 100)
        : (entry.amount !== 0 ? 100 : 0);

      return {
        id: String(index + 1),
        account: entry.accountTitle,
        code: entry.glCode,
        currentPeriod: entry.amount,
        priorPeriod: priorAmount,
        variance,
        variancePercentage: Math.round(variancePercentage * 10) / 10,
        type: entry.majorClassification as FinancialAccount["type"],
        group: entry.subClassification as FinancialAccount["group"],
      };
    });
  }, [entries, comparisonEntries]);

  // ─── Derived: ValidationStatus from summary ───
  const validation: ValidationStatus = React.useMemo(() => {
    if (!summary) return EMPTY_VALIDATION;

    return {
      totalAssets: summary.totalAssets,
      totalLiabilities: summary.totalLiabilities,
      totalEquity: summary.totalEquity,
      variance: summary.balanceVariance,
      isBalanced: summary.balanceVariance === 0,
    };
  }, [summary]);

  // ─── Derived: KeyRatios from summary + comparisonSummary ───
  const ratios: KeyRatios = React.useMemo(() => {
    if (!summary) return EMPTY_RATIOS;

    const prior = comparisonSummary || EMPTY_SUMMARY;

    return {
      currentRatio: {
        current: summary.currentRatio,
        prior: prior.currentRatio,
        variance: Math.round((summary.currentRatio - prior.currentRatio) * 100) / 100,
      },
      quickRatio: {
        current: summary.quickRatio,
        prior: prior.quickRatio,
        variance: Math.round((summary.quickRatio - prior.quickRatio) * 100) / 100,
      },
      debtToEquity: {
        current: summary.debtToEquityRatio,
        prior: prior.debtToEquityRatio,
        variance: Math.round((summary.debtToEquityRatio - prior.debtToEquityRatio) * 100) / 100,
      },
      debtRatio: {
        current: summary.debtRatio,
        prior: prior.debtRatio,
        variance: Math.round((summary.debtRatio - prior.debtRatio) * 100) / 100,
      },
    };
  }, [summary, comparisonSummary]);

  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS);
  };

  const value: BalanceSheetContextType = {
    entries,
    comparisonEntries,
    summary,
    comparisonSummary,
    accounts,
    validation,
    ratios,
    filters,
    setFilters,
    isLoading,
    error,
    refresh: fetchData,
    resetFilters,
  };

  return (
    <BalanceSheetContext.Provider value={value}>
      {children}
    </BalanceSheetContext.Provider>
  );
}

export function useBalanceSheetContext() {
  const context = React.useContext(BalanceSheetContext);
  if (context === undefined) {
    throw new Error("useBalanceSheetContext must be used within a BalanceSheetProvider");
  }
  return context;
}
