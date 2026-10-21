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
import { createDefaultFilterState, parseJournalEntryUrlState, serializeJournalEntryUrlState } from "../utils/filter-state";

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
  urlRevision: number;
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
  const initialUrlState = React.useRef(parseJournalEntryUrlState(new URLSearchParams(urlSearch)));
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
  const [currentPage, setCurrentPage] = React.useState(initialUrlState.current.page);
  const [pageSize, setPageSize] = React.useState(initialUrlState.current.pageSize);
  const [filters, setFilters] = React.useState<FilterState>(initialUrlState.current.filters);
  const [urlRevision, setUrlRevision] = React.useState(0);
  const lastObservedSearchRef = React.useRef(urlSearch);
  const skipUrlWriteRef = React.useRef(false);
  const initialUrlSyncRef = React.useRef(true);

  React.useEffect(() => {
    if (urlSearch === lastObservedSearchRef.current) return;

    lastObservedSearchRef.current = urlSearch;
    const restored = parseJournalEntryUrlState(new URLSearchParams(urlSearch));
    skipUrlWriteRef.current = true;
    setFilters(restored.filters);
    setCurrentPage(restored.page);
    setPageSize(restored.pageSize);
    setUrlRevision((revision) => revision + 1);
  }, [urlSearch]);

  React.useEffect(() => {
    if (skipUrlWriteRef.current) {
      skipUrlWriteRef.current = false;
      return;
    }

    const nextSearch = serializeJournalEntryUrlState(filters, currentPage, pageSize);
    if (nextSearch === urlSearch) {
      initialUrlSyncRef.current = false;
      return;
    }

    lastObservedSearchRef.current = nextSearch;
    const href = `${pathname}?${nextSearch}`;
    if (initialUrlSyncRef.current) {
      router.replace(href, { scroll: false });
      initialUrlSyncRef.current = false;
    } else {
      router.push(href, { scroll: false });
    }
  }, [filters, currentPage, pageSize, pathname, router, urlSearch]);

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
  const fetchData = React.useCallback(async () => {
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
      setUniqueSourceModules(["All Source Modules", ...(response.metadata.uniqueSourceModules || [])]);
      
      lastFetchedQueryRef.current = queryString;
    } catch (e: unknown) {
      console.error("Journal Entry Fetch Error:", e);
      const msg = e instanceof Error ? e.message : "Unknown error";
      setError(msg);
      toast.error(`Database Error: ${msg}`);
    } finally {
      setIsLoading(false);
    }
  }, [filters, currentPage, pageSize, paginatedGroups.length]);

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
    urlRevision,
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
    urlRevision,
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
