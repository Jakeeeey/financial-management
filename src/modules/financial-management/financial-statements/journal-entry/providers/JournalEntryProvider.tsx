"use client";

import * as React from "react";
import { 
  JournalEntry, 
  JournalEntryGroup, 
  AnalyticsSummary, 
  FilterState 
} from "../types";
import { 
  groupJournalEntries, 
  calculateAnalytics, 
  filterJournalEntries,
  sortJournalEntryGroups
} from "../services/journal-entry.helpers";
import { toast } from "sonner";

interface JournalEntryContextType {
  paginatedGroups: JournalEntryGroup[];
  analytics: AnalyticsSummary;
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  uniqueSourceModules: string[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  resetFilters: () => void;
  currentPage: number;
  pageSize: number;
  pageCount: number;
  totalGroupCount: number;
  setCurrentPage: (page: number) => void;
  setPageSize: (size: number) => void;
}

const JournalEntryContext = React.createContext<JournalEntryContextType | undefined>(undefined);

export function JournalEntryProvider({ children }: { children: React.ReactNode }) {
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
  const [totalGroupCount, setTotalGroupCount] = React.useState(0);
  const [pageCount, setPageCount] = React.useState(1);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [currentPage, setCurrentPage] = React.useState(0);
  const [pageSize, setPageSize] = React.useState(10);
  const [filters, setFilters] = React.useState<FilterState>(() => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const format = (date: Date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };

    return {
      search: "",
      startDate: format(firstDay),
      endDate: format(lastDay),
      presetRange: "Monthly",
      selectedMonth: now.getMonth(),
      selectedQuarter: Math.floor(now.getMonth() / 3) + 1,
      selectedYear: now.getFullYear(),
      branch: "All Branches",
      division: "All Divisions",
      department: "All Departments",
      entryType: "All Entry Types",
      coa: "All Accounts",
      sourceModule: "All Source Modules",
      showPostedOnly: false,
      status: "All Statuses",
      sortField: "date",
      sortOrder: "desc"
    };
  });

  // Synchronize startDate and endDate based on preset range selections
  React.useEffect(() => {
    if (filters.presetRange === "Custom") return;

    let start = new Date(filters.selectedYear, 0, 1);
    let end = new Date(filters.selectedYear, 11, 31);

    if (filters.presetRange === "Monthly") {
      start = new Date(filters.selectedYear, filters.selectedMonth, 1);
      end = new Date(filters.selectedYear, filters.selectedMonth + 1, 0);
    } else if (filters.presetRange === "Quarterly") {
      const startMonth = (filters.selectedQuarter - 1) * 3;
      start = new Date(filters.selectedYear, startMonth, 1);
      end = new Date(filters.selectedYear, startMonth + 3, 0);
    }

    const formatDateLocal = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const startStr = formatDateLocal(start);
    const endStr = formatDateLocal(end);

    if (startStr !== filters.startDate || endStr !== filters.endDate) {
      setFilters(prev => ({
        ...prev,
        startDate: startStr,
        endDate: endStr
      }));
    }
  }, [filters.presetRange, filters.selectedMonth, filters.selectedQuarter, filters.selectedYear]);

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
    } catch (e: any) {
      console.error("Journal Entry Fetch Error:", e);
      setError(e.message);
      toast.error(`Database Error: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [filters, currentPage, pageSize, paginatedGroups.length]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reset page to 0 when filters change (except for pagination handled keys)
  // We handle this carefully to avoid infinite loops
  const prevFiltersRef = React.useRef(filters);
  React.useEffect(() => {
    // If anything other than date bounds changed (which are handled by the date effects), reset page
    if (JSON.stringify(prevFiltersRef.current) !== JSON.stringify(filters)) {
      setCurrentPage(0);
      prevFiltersRef.current = filters;
    }
  }, [filters]);

  const resetFilters = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const format = (date: Date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };

    setFilters({
      search: "",
      startDate: format(firstDay),
      endDate: format(lastDay),
      presetRange: "Monthly",
      selectedMonth: now.getMonth(),
      selectedQuarter: Math.floor(now.getMonth() / 3) + 1,
      selectedYear: now.getFullYear(),
      branch: "All Branches",
      division: "All Divisions",
      department: "All Departments",
      entryType: "All Entry Types",
      coa: "All Accounts",
      sourceModule: "All Source Modules",
      showPostedOnly: false,
      status: "All Statuses",
      sortField: "date",
      sortOrder: "desc"
    });
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
    isLoading,
    error,
    refresh: fetchData,
    resetFilters,
    currentPage,
    pageSize,
    pageCount,
    totalGroupCount,
    setCurrentPage,
    setPageSize: handleSetPageSize,
  }), [
    paginatedGroups, 
    analytics, 
    filters, 
    uniqueSourceModules, 
    isLoading, 
    error, 
    fetchData, 
    currentPage, 
    pageSize, 
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
