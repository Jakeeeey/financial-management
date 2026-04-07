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
  filterJournalEntries 
} from "../services/journal-entry.helpers";
import { toast } from "sonner";

interface JournalEntryContextType {
  entries: JournalEntry[];
  filteredGroups: JournalEntryGroup[];
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
  const [entries, setEntries] = React.useState<JournalEntry[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [currentPage, setCurrentPage] = React.useState(0);
  const [pageSize, setPageSize] = React.useState(10);
  const [filters, setFilters] = React.useState<FilterState>({
    search: "",
    startDate: "2025-01-01",
    endDate: "2025-12-30",
    presetRange: "Yearly",
    branch: "All Branches",
    division: "All Divisions",
    department: "All Departments",
    entryType: "All Entry Types",
    coa: "All Accounts",
    sourceModule: "All Source Modules",
    showPostedOnly: false,
    status: "All Statuses",
  });

  const fetchData = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Use local API proxy instead of direct external IP
      const url = `/api/fm/financial-statements/journal-entry?startDate=${filters.startDate}&endDate=${filters.endDate}`;
      const res = await fetch(url);
      
      if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Failed to fetch ledger entries");
      }
      
      const data = await res.json();
      setEntries(Array.isArray(data) ? data : []);
    } catch (e: any) {
      console.error("Journal Entry Fetch Error:", e);
      setError(e.message);
      toast.error(`Database Error: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [filters.startDate, filters.endDate]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Derived state: Filtered entries and grouped data
  const { filteredGroups, analytics } = React.useMemo(() => {
    const filtered = filterJournalEntries(entries, filters);
    const groups = groupJournalEntries(filtered);
    const summary = calculateAnalytics(filtered, groups);
    
    return { 
      filteredGroups: groups, 
      analytics: summary 
    };
  }, [entries, filters]);

  // Reset page to 0 when filters change
  React.useEffect(() => {
    setCurrentPage(0);
  }, [filters]);

  const pageCount = Math.max(1, Math.ceil(filteredGroups.length / pageSize));

  // Paginated slice of groups for the current page
  const paginatedGroups = React.useMemo(() => {
    const start = currentPage * pageSize;
    return filteredGroups.slice(start, start + pageSize);
  }, [filteredGroups, currentPage, pageSize]);

  // Extract unique sorted Source Modules for filtering
  const uniqueSourceModules = React.useMemo(() => {
    const modules = new Set(entries.map((e) => e.sourceModule).filter(Boolean));
    return ["All Source Modules", ...Array.from(modules).sort()];
  }, [entries]);

  const resetFilters = () => {
    setFilters({
      search: "",
      startDate: "2025-01-01",
      endDate: "2025-12-30",
      presetRange: "Yearly",
      branch: "All Branches",
      division: "All Divisions",
      department: "All Departments",
      entryType: "All Entry Types",
      coa: "All Accounts",
      sourceModule: "All Source Modules",
      showPostedOnly: false,
      status: "All Statuses",
    });
  };

  const handleSetPageSize = (size: number) => {
    setPageSize(size);
    setCurrentPage(0);
  };

  const value = {
    entries,
    filteredGroups,
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
    totalGroupCount: filteredGroups.length,
    setCurrentPage,
    setPageSize: handleSetPageSize,
  };

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
