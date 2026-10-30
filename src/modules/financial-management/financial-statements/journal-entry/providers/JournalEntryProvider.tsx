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

    const loadFilterOptions = async () => {
      try {
        const response = await fetch("/api/fm/financial-statements/journal-entry/lookups", { cache: "no-store" });
        if (!response.ok) throw new Error("Unable to load branch, division, and department options.");

        const data = await response.json() as Partial<JournalEntryFilterOptions>;
        if (!active) return;

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
        if (!active) return;
        const message = loadError instanceof Error ? loadError.message : "Unable to load filter options.";
        setFilterOptionsError(message);
        console.error("Journal Entry Filter Options Error:", loadError);
      } finally {
        if (active) setFilterOptionsLoading(false);
      }
    };

    loadFilterOptions();
    return () => { active = false; };
  }, []);

  const lastFetchedQueryRef = React.useRef<string>("");
  const sourceScopeRef = React.useRef<string | null>(null);
  const fetchData = React.useCallback(async () => {
    if (!ready) return;
    try {
      const query = new URLSearchParams();
      query.set("page", currentPage.toString());
      query.set("pageSize", pageSize.toString());
      
      // Add all filters to query string
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          query.set(key, value.toString());
        }
      });

      const queryString = query.toString();

      // Guard: Don't refetch if parameters haven't changed
      if (lastFetchedQueryRef.current === queryString && paginatedGroups.length > 0) {
        return;
      }

      setIsLoading(true);
      setError(null);

      const url = `/api/fm/financial-statements/journal-entry?${queryString}`;
      const res = await fetch(url);
      
      if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Failed to fetch ledger entries");
      }
      
      const response = await res.json();
      
      // Update state with server response
      setPaginatedGroups(response.data || []);
      setAnalytics(response.analytics);
      setTotalGroupCount(response.metadata.totalGroups);
      setPageCount(response.metadata.totalPages);
      const sourceScope = JSON.stringify([filters.startDate, filters.endDate, filters.accountNumber || ""]);
      const sameSourceScope = sourceScopeRef.current === sourceScope;
      sourceScopeRef.current = sourceScope;
      const sources = (response.metadata.uniqueSourceModules || []).filter((source: unknown): source is string => typeof source === "string" && Boolean(source.trim()));
      setUniqueSourceModules(current => ["All Source Modules", ...Array.from(new Set([...(sameSourceScope ? current.filter(source => source !== "All Source Modules") : []), ...sources])).sort()]);
      
      lastFetchedQueryRef.current = queryString;
    } catch (e: unknown) {
      console.error("Journal Entry Fetch Error:", e);
      const msg = e instanceof Error ? e.message : "Unknown error";
      setError(msg);
      toast.error(`Database Error: ${msg}`);
    } finally {
      setIsLoading(false);
    }
  }, [ready, filters, currentPage, pageSize, paginatedGroups.length]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

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
    filters,
    setFilters,
    uniqueSourceModules,
    filterOptions,
    filterOptionsLoading,
    filterOptionsError,
    isLoading,
    error,
    refresh: fetchData,
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
    filters, 
    uniqueSourceModules,
    filterOptions,
    filterOptionsLoading,
    filterOptionsError,
    isLoading, 
    error, 
    fetchData, 
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
