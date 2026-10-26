"use client";

import * as React from "react";
import {
  BalanceSheetEntry,
  BalanceSheetSummary,
  BalanceSheetFilterState,
  BalanceSheetEntrySchema,
  BalanceSheetSummarySchema,
} from "../types/balance-sheet.schema";
import { BalanceSheetComparisonStatus, FinancialAccount, ValidationStatus, KeyRatios } from "../types";
import {
  DEFAULT_BALANCE_SHEET_FILTERS,
  hasPendingBalanceSheetChanges,
  parseBalanceSheetUrl,
  removeBalanceSheetFilterChip,
  writeBalanceSheetFiltersToSearchParams,
  type BalanceSheetFilterChipKey,
} from "../utils/report-state";

export type BalanceSheetReportStatus =
  | "not-generated"
  | "loading-initial"
  | "refreshing"
  | "success"
  | "empty"
  | "initial-error"
  | "refresh-error";

interface BalanceSheetContextType {
  // Raw API data
  entries: BalanceSheetEntry[];
  comparisonEntries: BalanceSheetEntry[];
  summary: BalanceSheetSummary | null;
  comparisonSummary: BalanceSheetSummary | null;
  comparisonStatus: BalanceSheetComparisonStatus;

  // Derived data for the UI components
  accounts: FinancialAccount[];
  validation: ValidationStatus;
  ratios: KeyRatios;

  // State
  filters: BalanceSheetFilterState;
  appliedFilters: BalanceSheetFilterState | null;
  hasPendingChanges: boolean;
  setFilters: React.Dispatch<React.SetStateAction<BalanceSheetFilterState>>;
  isLoading: boolean;
  reportStatus: BalanceSheetReportStatus;
  lastUpdated: Date | null;
  error: string | null;

  // Actions
  refresh: () => Promise<void>;
  resetFilters: () => void;
  removeAppliedFilter: (key: BalanceSheetFilterChipKey) => void;
}

const EMPTY_VALIDATION: ValidationStatus = {
  totalAssets: 0,
  totalLiabilities: 0,
  totalEquity: 0,
  variance: 0,
  isBalanced: true,
};

const EMPTY_RATIOS: KeyRatios = {
  currentRatio: { current: null, prior: null, variance: null },
  quickRatio: { current: null, prior: null, variance: null },
  debtToEquity: { current: null, prior: null, variance: null },
  debtRatio: { current: null, prior: null, variance: null },
};

const BalanceSheetContext = React.createContext<BalanceSheetContextType | undefined>(undefined);

export function BalanceSheetProvider({ children }: { children: React.ReactNode }) {
  const [entries, setEntries] = React.useState<BalanceSheetEntry[]>([]);
  const [comparisonEntries, setComparisonEntries] = React.useState<BalanceSheetEntry[]>([]);
  const [summary, setSummary] = React.useState<BalanceSheetSummary | null>(null);
  const [comparisonSummary, setComparisonSummary] = React.useState<BalanceSheetSummary | null>(null);
  const [comparisonStatus, setComparisonStatus] = React.useState<BalanceSheetComparisonStatus>("disabled");
  const [isLoading, setIsLoading] = React.useState(false);
  const [reportStatus, setReportStatus] = React.useState<BalanceSheetReportStatus>("not-generated");
  const [lastUpdated, setLastUpdated] = React.useState<Date | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [filters, setFilters] = React.useState<BalanceSheetFilterState>({ ...DEFAULT_BALANCE_SHEET_FILTERS });
  const [appliedFilters, setAppliedFilters] = React.useState<BalanceSheetFilterState | null>(null);

  const filtersRef = React.useRef(filters);
  const appliedFiltersRef = React.useRef<BalanceSheetFilterState | null>(null);
  const requestGenerationRef = React.useRef(0);
  const observedSearchRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  const fetchData = React.useCallback(async (
    overrideFilters?: BalanceSheetFilterState,
    urlMode: false | "push" | "replace" = false,
  ) => {
    const currentFilters = overrideFilters || filtersRef.current;
    const requestGeneration = ++requestGenerationRef.current;
    const hasPreviousReport = appliedFiltersRef.current !== null;
    filtersRef.current = currentFilters;
    setIsLoading(true);
    setReportStatus(hasPreviousReport ? "refreshing" : "loading-initial");
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
      if (requestGeneration !== requestGenerationRef.current) return;

      const safeNumber = (num: unknown) => (typeof num === "number" && Number.isFinite(num) ? num : 0);

      const hasUniqueAccountIds = (items: BalanceSheetEntry[]) => {
        const ids = new Set<number>();
        return items.every(item => {
          if (!Number.isInteger(item.coaId) || ids.has(item.coaId)) return false;
          ids.add(item.coaId);
          return true;
        });
      };

      const normalizeSummary = (s: Record<string, unknown> | null) => {
        if (!s) return null;
        // Preserve signs: a credit-balance asset (e.g. an unfunded petty cash
        // account) must render negative instead of being flipped positive.
        const totalAssets = safeNumber(s.totalAssets);
        const totalLiabilities = safeNumber(s.totalLiabilities);
        const totalEquity = safeNumber(s.totalEquity);
        let variance = totalAssets - (totalLiabilities + totalEquity);
        // Handle floating point precision issues
        variance = Math.round(variance * 100) / 100;

        return {
          ...s,
          totalAssets,
          totalLiabilities,
          totalEquity,
          balanceVariance: variance
        } as unknown as BalanceSheetSummary;
      };

      const currentEntriesResult = BalanceSheetEntrySchema.array().safeParse(data.entries);
      if (!currentEntriesResult.success) {
        throw new Error("The balance sheet response did not include valid account entries.");
      }

      const normalizedEntries = currentEntriesResult.data;
      if (!hasUniqueAccountIds(normalizedEntries)) {
        throw new Error("The balance sheet response contains missing or duplicate account identifiers.");
      }
      const comparisonEntriesResult = BalanceSheetEntrySchema.array().safeParse(data.comparisonEntries);
      const normalizedComparisonSummary = normalizeSummary(data.comparisonSummary);
      const hasValidComparisonSummary = BalanceSheetSummarySchema.safeParse(data.comparisonSummary).success;
      const hasAvailableComparison = currentFilters.includeComparison
        && comparisonEntriesResult.success
        && normalizedComparisonSummary !== null
        && hasValidComparisonSummary
        && hasUniqueAccountIds(comparisonEntriesResult.data);
      const normalizedComparisonEntries = comparisonEntriesResult.success ? comparisonEntriesResult.data : [];

      setEntries(normalizedEntries);
      setComparisonEntries(hasAvailableComparison ? normalizedComparisonEntries : []);
      setSummary(normalizeSummary(data.summary));
      setComparisonSummary(hasAvailableComparison ? normalizedComparisonSummary : null);
      setComparisonStatus(currentFilters.includeComparison
        ? hasAvailableComparison ? "available" : "unavailable"
        : "disabled");
      appliedFiltersRef.current = { ...currentFilters };
      setAppliedFilters({ ...currentFilters });
      setLastUpdated(new Date());
      setReportStatus(normalizedEntries.length > 0 || (hasAvailableComparison && normalizedComparisonEntries.length > 0) ? "success" : "empty");

      if (urlMode && typeof window !== "undefined") {
        const url = new URL(window.location.href);
        writeBalanceSheetFiltersToSearchParams(url.searchParams, currentFilters);
        const nextUrl = `${url.pathname}${url.search}${url.hash}`;
        const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
        if (nextUrl !== currentUrl) {
          if (urlMode === "push") window.history.pushState(window.history.state, "", nextUrl);
          else window.history.replaceState(window.history.state, "", nextUrl);
        }
        observedSearchRef.current = window.location.search;
      }
    } catch (e: unknown) {
      if (requestGeneration !== requestGenerationRef.current) return;
      const message = e instanceof Error ? e.message : "Unknown error";
      console.error("Balance Sheet Fetch Error:", e);
      setError(message);
      setReportStatus(hasPreviousReport ? "refresh-error" : "initial-error");
    } finally {
      if (requestGeneration === requestGenerationRef.current) setIsLoading(false);
    }
  }, []);

  const clearReport = React.useCallback(() => {
    requestGenerationRef.current += 1;
    appliedFiltersRef.current = null;
    setEntries([]);
    setComparisonEntries([]);
    setSummary(null);
    setComparisonSummary(null);
    setComparisonStatus("disabled");
    setAppliedFilters(null);
    setReportStatus("not-generated");
    setLastUpdated(null);
    setError(null);
    setIsLoading(false);
  }, []);

  React.useEffect(() => {
    const loadLocationReport = () => {
      const currentSearch = window.location.search;
      if (observedSearchRef.current === currentSearch) return;
      observedSearchRef.current = currentSearch;

      const parsed = parseBalanceSheetUrl(new URLSearchParams(currentSearch));
      filtersRef.current = parsed.filters;
      setFilters(parsed.filters);

      if (parsed.hasReportCriteria) {
        void fetchData(parsed.filters, "replace");
      } else {
        clearReport();
      }
    };

    loadLocationReport();
    window.addEventListener("popstate", loadLocationReport);
    return () => window.removeEventListener("popstate", loadLocationReport);
  }, [clearReport, fetchData]);

  /* 
  React.useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  */

  // ─── Derived: Union current and comparison accounts by stable coa_id ───
  const accounts: FinancialAccount[] = React.useMemo(() => {
    const currentMap = new Map<number, BalanceSheetEntry>();
    for (const entry of entries) currentMap.set(entry.coaId, entry);

    const comparisonMap = new Map<number, BalanceSheetEntry>();
    for (const ce of comparisonEntries) {
      comparisonMap.set(ce.coaId, ce);
    }

    const accountIds = [...currentMap.keys()];
    if (comparisonStatus === "available") {
      for (const id of comparisonMap.keys()) {
        if (!currentMap.has(id)) accountIds.push(id);
      }
    }

    return accountIds.map(id => {
      const currentEntry = currentMap.get(id);
      const comparisonEntry = comparisonMap.get(id);
      const entry = currentEntry ?? comparisonEntry!;
      const currentAmount = currentEntry?.amount ?? 0;
      const priorAmount = comparisonStatus === "available" ? comparisonEntry?.amount ?? 0 : null;
      const variance = priorAmount === null ? null : currentAmount - priorAmount;
      const variancePercentage = priorAmount === null || priorAmount === 0
        ? null
        : (variance! / Math.abs(priorAmount)) * 100;

      return {
        id: String(id),
        coaId: id,
        account: entry.accountTitle,
        code: entry.glCode,
        currentPeriod: currentAmount,
        currentBalanceStatus: currentEntry ? "reported" : "zero",
        priorPeriod: priorAmount,
        comparisonBalanceStatus: comparisonStatus === "unavailable"
          ? "unavailable"
          : comparisonStatus === "disabled"
            ? "disabled"
            : comparisonEntry ? "reported" : "zero",
        variance,
        variancePercentage: variancePercentage === null ? null : Math.round(variancePercentage * 10) / 10,
        type: entry.majorClassification as FinancialAccount["type"],
        group: entry.subClassification as FinancialAccount["group"],
      };
    });
  }, [entries, comparisonEntries, comparisonStatus]);

  // ─── Derived: ValidationStatus from summary ───
  const validation: ValidationStatus = React.useMemo(() => {
    if (!summary) return EMPTY_VALIDATION;

    return {
      totalAssets: summary.totalAssets,
      totalLiabilities: summary.totalLiabilities,
      totalEquity: summary.totalEquity,
      variance: summary.balanceVariance,
      isBalanced: Math.abs(summary.balanceVariance) < 0.005,
    };
  }, [summary]);

  // ─── Derived: KeyRatios from summary + comparisonSummary ───
  const ratios: KeyRatios = React.useMemo(() => {
    if (!summary) return EMPTY_RATIOS;

    const prior = comparisonStatus === "available" ? comparisonSummary : null;
    const toRatioValue = (current: number | null, previous: number | null) => ({
      current,
      prior: previous,
      variance: current !== null && previous !== null
        ? Math.round((current - previous) * 100) / 100
        : null,
    });

    return {
      currentRatio: toRatioValue(summary.currentRatio, prior?.currentRatio ?? null),
      quickRatio: toRatioValue(summary.quickRatio, prior?.quickRatio ?? null),
      debtToEquity: toRatioValue(summary.debtToEquityRatio, prior?.debtToEquityRatio ?? null),
      debtRatio: toRatioValue(summary.debtRatio, prior?.debtRatio ?? null),
    };
  }, [summary, comparisonSummary, comparisonStatus]);

  const resetFilters = () => {
    setFilters({ ...DEFAULT_BALANCE_SHEET_FILTERS });
  };

  const removeAppliedFilter = (key: BalanceSheetFilterChipKey) => {
    setFilters(current => removeBalanceSheetFilterChip(current, key));
  };

  const hasPendingChanges = hasPendingBalanceSheetChanges(filters, appliedFilters);

  const value: BalanceSheetContextType = {
    entries,
    comparisonEntries,
    summary,
    comparisonSummary,
    comparisonStatus,
    accounts,
    validation,
    ratios,
    filters,
    appliedFilters,
    hasPendingChanges,
    setFilters,
    isLoading,
    reportStatus,
    lastUpdated,
    error,
    refresh: () => fetchData(filters, "push"),
    resetFilters,
    removeAppliedFilter,
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
