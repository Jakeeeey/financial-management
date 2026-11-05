"use client";

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import type { TrialBalanceItem, TrialBalanceFilterState, TrialBalanceReportContext, TrialBalanceSummaryData } from "../types/trial-balance.schema";
import { createDefaultTrialBalanceFilters } from "../utils/periods";
import { calculateTrialBalanceSummary } from "../utils/summary";
import {
  getNeedsReviewTrialBalanceFilters, normalizeTrialBalanceFilters, parseTrialBalanceUrlState, serializeTrialBalanceFilters,
  trialBalanceFilterReset, trialBalanceRequestQuery, trialBalanceUrlQuery, validateTrialBalanceFilters,
  type TrialBalanceFilterKey,
} from "../utils/filter-state";

interface TrialBalanceContextType {
  items: TrialBalanceItem[];
  summary: TrialBalanceSummaryData;
  reportContext: TrialBalanceReportContext | null;
  lastUpdatedAt: Date | null;
  draftFilters: TrialBalanceFilterState;
  setDraftFilters: React.Dispatch<React.SetStateAction<TrialBalanceFilterState>>;
  hasPendingChanges: boolean;
  isLoading: boolean;
  error: string | null;
  urlError: string | null;
  validationError: string | null;
  applyFilters: () => void;
  showAccountsNeedingReview: () => void;
  removeFilter: (key: TrialBalanceFilterKey) => void;
  clearFilters: () => void;
  refresh: () => Promise<void>;
}

const TrialBalanceContext = React.createContext<TrialBalanceContextType | undefined>(undefined);

export function TrialBalanceProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlSearch = searchParams.toString();
  const urlState = React.useMemo(() => parseTrialBalanceUrlState(new URLSearchParams(urlSearch)), [urlSearch]);
  const requestedKey = serializeTrialBalanceFilters(urlState.filters);
  const [draftFilters, setDraftFilters] = React.useState(urlState.filters);
  const [report, setReport] = React.useState<{ items: TrialBalanceItem[]; context: TrialBalanceReportContext | null }>({ items: [], context: null });
  const { items, context: reportContext } = report;
  const [lastUpdatedAt, setLastUpdatedAt] = React.useState<Date | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const requestGenerationRef = React.useRef(0);
  const requestControllerRef = React.useRef<AbortController | null>(null);
  const ownNavigationRef = React.useRef<string | null>(null);
  const lastObservedSearchRef = React.useRef(urlSearch);

  React.useEffect(() => {
    if (lastObservedSearchRef.current === urlSearch) return;
    lastObservedSearchRef.current = urlSearch;
    if (ownNavigationRef.current === urlSearch) {
      ownNavigationRef.current = null;
      return;
    }
    setDraftFilters(urlState.filters);
  }, [urlSearch, urlState.filters]);

  React.useEffect(() => {
    if (urlState.error || window.location.search.slice(1) !== urlSearch) return;
    const canonical = trialBalanceUrlQuery(urlState.filters, urlSearch);
    if (canonical !== urlSearch) {
      ownNavigationRef.current = canonical;
      window.history.replaceState(null, "", `${pathname}?${canonical}${window.location.hash}`);
    }
  }, [urlSearch, urlState.filters, urlState.error, pathname]);

  const loadReport = React.useCallback(async (filters: TrialBalanceFilterState) => {
    const generation = ++requestGenerationRef.current;
    requestControllerRef.current?.abort();
    const controller = new AbortController();
    requestControllerRef.current = controller;
    const context = normalizeTrialBalanceFilters(filters);
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/fm/financial-statements/trial-balance?${trialBalanceRequestQuery(context)}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error || "Failed to fetch trial balance");
      }
      const data = await response.json();
      if (generation !== requestGenerationRef.current) return;
      setReport({ items: Array.isArray(data) ? data : [], context });
      setLastUpdatedAt(new Date());
    } catch (failure: unknown) {
      if (controller.signal.aborted || generation !== requestGenerationRef.current) return;
      const message = failure instanceof Error ? failure.message : "Unknown error";
      setError(message);
      toast.error(`Trial balance: ${message}`);
    } finally {
      if (generation === requestGenerationRef.current) setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (urlState.error) {
      setIsLoading(false);
      setError(null);
    } else {
      void loadReport(parseTrialBalanceUrlState(new URLSearchParams(requestedKey)).filters);
    }
    return () => {
      requestGenerationRef.current += 1;
      requestControllerRef.current?.abort();
    };
  }, [requestedKey, urlState.error, loadReport]);

  const commitFilters = (filters: TrialBalanceFilterState) => {
    requestGenerationRef.current += 1;
    requestControllerRef.current?.abort();
    setIsLoading(true);
    setError(null);
    const next = normalizeTrialBalanceFilters(filters);
    // Read the live URL so a rapid Clear all cannot lose to an earlier filter action.
    const currentSearch = window.location.search.slice(1);
    const nextSearch = trialBalanceUrlQuery(next, currentSearch);
    if (nextSearch === currentSearch) {
      void loadReport(next);
    } else {
      ownNavigationRef.current = nextSearch;
      window.history.pushState(null, "", `${pathname}?${nextSearch}${window.location.hash}`);
    }
  };

  const validationError = validateTrialBalanceFilters(draftFilters);
  const applyFilters = () => {
    if (validationError) return;
    const next = normalizeTrialBalanceFilters(draftFilters);
    setDraftFilters(next);
    commitFilters(next);
  };
  const showAccountsNeedingReview = () => {
    const next = getNeedsReviewTrialBalanceFilters(draftFilters);
    if (validateTrialBalanceFilters(next)) return;
    setDraftFilters(next);
    commitFilters(next);
  };
  const clearFilters = () => {
    const defaults = createDefaultTrialBalanceFilters();
    setDraftFilters(defaults);
    commitFilters(defaults);
  };
  const removeFilter = (key: TrialBalanceFilterKey) => {
    if (!reportContext) return;
    setDraftFilters(current => ({ ...current, ...trialBalanceFilterReset(current, key) }));
    commitFilters({ ...reportContext, ...trialBalanceFilterReset(reportContext, key) });
  };
  const summary = React.useMemo(() => calculateTrialBalanceSummary(items, reportContext), [items, reportContext]);
  const hasPendingChanges = !reportContext || serializeTrialBalanceFilters(draftFilters) !== serializeTrialBalanceFilters(reportContext);

  return (
    <TrialBalanceContext.Provider value={{
      items, summary, reportContext, lastUpdatedAt, draftFilters, setDraftFilters, hasPendingChanges,
      isLoading, error, urlError: urlState.error, validationError, applyFilters, showAccountsNeedingReview, removeFilter, clearFilters,
      refresh: () => loadReport(parseTrialBalanceUrlState(new URLSearchParams(requestedKey)).filters),
    }}>
      {children}
    </TrialBalanceContext.Provider>
  );
}

export function useTrialBalanceContext() {
  const context = React.useContext(TrialBalanceContext);
  if (!context) throw new Error("useTrialBalanceContext must be used within a TrialBalanceProvider");
  return context;
}
