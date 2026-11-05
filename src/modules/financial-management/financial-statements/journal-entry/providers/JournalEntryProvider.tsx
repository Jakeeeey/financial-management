"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { 
  JournalEntryGroup, 
  AnalyticsSummary, 
  FilterState,
  JournalEntryFilterOptions,
} from "../types";
import { toast } from "sonner";
import { createDefaultFilterState, parseJournalEntryUrlState } from "../utils/filter-state";

interface JournalEntryContextType {
  paginatedGroups: JournalEntryGroup[];
  analytics: AnalyticsSummary;
  analyticsLoading: boolean;
  analyticsError: string | null;
  refreshAnalytics: () => Promise<void>;
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  uniqueSourceModules: string[];
  filterOptions: JournalEntryFilterOptions;
  filterOptionsLoading: boolean;
  filterOptionsError: string | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  resetFilters: () => void;
  currentPage: number;
  pageSize: number;
  viewRevision: number;
  pageCount: number;
  totalGroupCount: number;
  setCurrentPage: (page: number) => void;
  setPageSize: (size: number) => void;
}

const JournalEntryContext = React.createContext<JournalEntryContextType | undefined>(undefined);

const EMPTY_FILTER_OPTIONS: JournalEntryFilterOptions = {
  branches: [],
  divisions: [],
  departments: [],
};

export function JournalEntryProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlSearch = searchParams.toString();
  const initialState = React.useRef(parseJournalEntryUrlState(new URLSearchParams()));
  const [paginatedGroups, setPaginatedGroups] = React.useState<JournalEntryGroup[]>([]);
  const [analytics, setAnalytics] = React.useState<AnalyticsSummary>({
    jeCount: 0,
    totalDebit: 0,
    totalCredit: 0,
    netBalance: 0,
    largestEntry: 0,
    imbalancedCount: 0,
    postedCount: 0,
    unpostedCount: 0,
    statusBreakdown: {},
    highRiskEntries: []
  });
  const [analyticsLoading, setAnalyticsLoading] = React.useState(true);
  const [analyticsError, setAnalyticsError] = React.useState<string | null>(null);
  const [analyticsScope, setAnalyticsScope] = React.useState("");
  const [uniqueSourceModules, setUniqueSourceModules] = React.useState<string[]>(["All Source Modules"]);
  const [filterOptions, setFilterOptions] = React.useState<JournalEntryFilterOptions>(EMPTY_FILTER_OPTIONS);
  const [filterOptionsLoading, setFilterOptionsLoading] = React.useState(true);
  const [filterOptionsError, setFilterOptionsError] = React.useState<string | null>(null);
  const [totalGroupCount, setTotalGroupCount] = React.useState(0);
  const [pageCount, setPageCount] = React.useState(1);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [currentPage, setCurrentPage] = React.useState(initialState.current.page);
  const [pageSize, setPageSize] = React.useState(initialState.current.pageSize);
  const [filters, setFilters] = React.useState<FilterState>(initialState.current.filters);
  const [viewRevision, setViewRevision] = React.useState(0);
  const initialized = React.useRef(false);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    if (pathname !== "/fm/financial-statements/journal-entry") return;
    if (initialized.current && !urlSearch) return;
    initialized.current = true;
    const restored = parseJournalEntryUrlState(new URLSearchParams(urlSearch));
    setFilters(restored.filters);
    setCurrentPage(restored.page);
    setPageSize(restored.pageSize);
    lastFetchedQueryRef.current = "";
    setViewRevision(revision => revision + 1);
    setReady(true);
    if (urlSearch) router.replace(pathname, { scroll: false });
  }, [urlSearch, pathname, router]);

  React.useEffect(() => {
    let active = true;
    const controller = new AbortController();

    const loadFilterOptions = async () => {
      try {
        const response = await fetch("/api/fm/financial-statements/journal-entry/lookups", { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Unable to load branch, division, and department options.");

        const data = await response.json() as Partial<JournalEntryFilterOptions>;
        if (!active || controller.signal.aborted) return;

        const normalizeOptions = (options: JournalEntryFilterOptions["branches"] | undefined) =>
          Array.isArray(options)
            ? options
                .filter((option) => option && option.id != null && option.name?.trim())
                .map((option) => ({ id: String(option.id), name: option.name.trim() }))
            : [];

        setFilterOptions({
          branches: normalizeOptions(data.branches),
          divisions: normalizeOptions(data.divisions),
          departments: normalizeOptions(data.departments),
        });
        setFilterOptionsError(null);
      } catch (loadError) {
        if (!active || controller.signal.aborted) return;
        const message = loadError instanceof Error ? loadError.message : "Unable to load filter options.";
        setFilterOptionsError(message);
        console.error("Journal Entry Filter Options Error:", loadError);
      } finally {
        if (active && !controller.signal.aborted) setFilterOptionsLoading(false);
      }
    };

    loadFilterOptions();
    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  const lastFetchedQueryRef = React.useRef<string>("");
  const activeRequestRef = React.useRef<{ query: string; promise: Promise<void> } | null>(null);
  const requestControllerRef = React.useRef<AbortController | null>(null);
  const requestSequenceRef = React.useRef(0);
  const sourceScopeRef = React.useRef<string | null>(null);
  const cancelActiveRequest = React.useCallback(() => {
    // Invalidate before aborting so obsolete handlers cannot change current state.
    ++requestSequenceRef.current;
    requestControllerRef.current?.abort();
    requestControllerRef.current = null;
    activeRequestRef.current = null;
  }, []);
  const fetchData = React.useCallback(async (force = false) => {
    if (!ready) return;
    const query = new URLSearchParams();
    query.set("page", currentPage.toString());
    query.set("pageSize", pageSize.toString());
    query.set("includeAnalytics", "false");

    // Add all filters to query string
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        query.set(key, value.toString());
      }
    });

    const queryString = query.toString();

    if (activeRequestRef.current?.query === queryString) {
      return activeRequestRef.current.promise;
    }

    cancelActiveRequest();
    if (!force && lastFetchedQueryRef.current === queryString) {
      setIsLoading(false);
      return;
    }

    const requestId = requestSequenceRef.current;
    const controller = new AbortController();
    const isCurrentRequest = () => requestSequenceRef.current === requestId && !controller.signal.aborted;
    requestControllerRef.current = controller;
    setIsLoading(true);
    setError(null);

      // Defer execution until the active promise has been registered.
      const promise = Promise.resolve().then(async () => {
        try {
        const url = `/api/fm/financial-statements/journal-entry?${queryString}`;
        const res = await fetch(url, { signal: controller.signal });

        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || "Failed to fetch ledger entries");
        }

        const response = await res.json();
        if (!isCurrentRequest()) return;

        // Update state with server response
        setPaginatedGroups(response.data || []);
        setTotalGroupCount(response.metadata.totalGroups);
        setPageCount(response.metadata.totalPages);
        const sourceScope = JSON.stringify([filters.startDate, filters.endDate, filters.accountNumber || ""]);
        const sameSourceScope = sourceScopeRef.current === sourceScope;
        sourceScopeRef.current = sourceScope;
        const sources = (response.metadata.uniqueSourceModules || []).filter((source: unknown): source is string => typeof source === "string" && Boolean(source.trim()));
        setUniqueSourceModules(current => ["All Source Modules", ...Array.from(new Set([...(sameSourceScope ? current.filter(source => source !== "All Source Modules") : []), ...sources])).sort()]);

        lastFetchedQueryRef.current = queryString;
      } catch (e: unknown) {
        if (!isCurrentRequest()) return;
        lastFetchedQueryRef.current = "";
        console.error("Journal Entry Fetch Error:", e);
        const msg = e instanceof Error ? e.message : "Unknown error";
        setError(msg);
        toast.error(`Database Error: ${msg}`);
      } finally {
        if (isCurrentRequest()) {
          requestControllerRef.current = null;
          activeRequestRef.current = null;
          setIsLoading(false);
        }
      }
      });
      activeRequestRef.current = { query: queryString, promise };
      return promise;
  }, [ready, filters, currentPage, pageSize, cancelActiveRequest]);

  const refresh = React.useCallback(() => fetchData(true), [fetchData]);

  React.useEffect(() => {
    fetchData();
    return cancelActiveRequest;
  }, [fetchData, cancelActiveRequest]);

  const analyticsQuery = new URLSearchParams();
  for (const key of ["startDate", "endDate", "search", "entryType", "branch", "division", "department", "coa", "accountNumber", "sourceModule", "status"] as const) {
    const value = filters[key];
    if (value !== undefined && value !== null) analyticsQuery.set(key, String(value));
  }
  const analyticsKey = analyticsQuery.toString();
  const analyticsRequestRef = React.useRef<{ key: string; promise: Promise<void> } | null>(null);
  const analyticsControllerRef = React.useRef<AbortController | null>(null);
  const analyticsSequenceRef = React.useRef(0);
  const analyticsSuccessRef = React.useRef("");
  const cancelAnalytics = React.useCallback(() => {
    ++analyticsSequenceRef.current;
    analyticsControllerRef.current?.abort();
    analyticsControllerRef.current = null;
    analyticsRequestRef.current = null;
  }, []);
  const fetchAnalytics = React.useCallback(async (force = false) => {
    if (!ready) return;
    if (analyticsRequestRef.current?.key === analyticsKey) return analyticsRequestRef.current.promise;
    cancelAnalytics();
    if (!force && analyticsSuccessRef.current === analyticsKey) {
      setAnalyticsLoading(false);
      return;
    }
    const sequence = analyticsSequenceRef.current;
    const controller = new AbortController();
    analyticsControllerRef.current = controller;
    const isCurrent = () => sequence === analyticsSequenceRef.current && !controller.signal.aborted;
    setAnalyticsLoading(true);
    setAnalyticsError(null);
    const promise = Promise.resolve().then(async () => {
      try {
        const response = await fetch(`/api/fm/financial-statements/journal-entry/analytics?${analyticsKey}`, { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error("Unable to load journal analytics. Please retry.");
        const data: AnalyticsSummary = await response.json();
        if (!isCurrent()) return;
        setAnalytics(data);
        analyticsSuccessRef.current = analyticsKey;
        setAnalyticsScope(analyticsKey);
      } catch (error: unknown) {
        if (!isCurrent()) return;
        analyticsSuccessRef.current = "";
        setAnalyticsScope(analyticsKey);
        setAnalyticsError(error instanceof Error ? error.message : "Unable to load journal analytics.");
      } finally {
        if (isCurrent()) {
          analyticsControllerRef.current = null;
          analyticsRequestRef.current = null;
          setAnalyticsLoading(false);
        }
      }
    });
    analyticsRequestRef.current = { key: analyticsKey, promise };
    return promise;
  }, [ready, analyticsKey, cancelAnalytics]);
  const refreshAnalytics = React.useCallback(() => fetchAnalytics(true), [fetchAnalytics]);
  React.useEffect(() => {
    fetchAnalytics();
    return cancelAnalytics;
  }, [fetchAnalytics, cancelAnalytics]);

  const resetFilters = () => {
    setFilters(createDefaultFilterState());
    setCurrentPage(0);
  };

  const handleSetPageSize = (size: number) => {
    setPageSize(size);
    setCurrentPage(0);
  };

  const value = React.useMemo(() => ({
    paginatedGroups,
    analytics,
    analyticsLoading: analyticsLoading || analyticsScope !== analyticsKey,
    analyticsError: analyticsScope === analyticsKey ? analyticsError : null,
    refreshAnalytics,
    filters,
    setFilters,
    uniqueSourceModules,
    filterOptions,
    filterOptionsLoading,
    filterOptionsError,
    isLoading,
    error,
    refresh,
    resetFilters,
    currentPage,
    pageSize,
    viewRevision,
    pageCount,
    totalGroupCount,
    setCurrentPage,
    setPageSize: handleSetPageSize,
  }), [
    paginatedGroups, 
    analytics,
    analyticsLoading,
    analyticsScope,
    analyticsKey,
    analyticsError,
    refreshAnalytics,
    filters, 
    uniqueSourceModules,
    filterOptions,
    filterOptionsLoading,
    filterOptionsError,
    isLoading, 
    error, 
    refresh,
    currentPage, 
    pageSize, 
    viewRevision,
    pageCount, 
    totalGroupCount
  ]);

  return (
    <JournalEntryContext.Provider value={value}>
      {children}
    </JournalEntryContext.Provider>
  );
}

export function useJournalEntryContext() {
  const context = React.useContext(JournalEntryContext);
  if (context === undefined) {
    throw new Error("useJournalEntryContext must be used within a JournalEntryProvider");
  }
  return context;
}
