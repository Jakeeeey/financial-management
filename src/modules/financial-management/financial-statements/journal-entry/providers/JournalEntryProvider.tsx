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
  const [filters, setFilters] = React.useState<FilterState>(() => {
    const now = new Date();
    return {
      search: "",
      startDate: `${now.getFullYear()}-01-01`,
      endDate: `${now.getFullYear()}-12-31`,
      presetRange: "Yearly",
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
    const sortedGroups = sortJournalEntryGroups(groups, filters);
    const summary = calculateAnalytics(filtered, sortedGroups);
    
    return { 
      filteredGroups: sortedGroups, 
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
    const now = new Date();
    setFilters({
      search: "",
      startDate: `${now.getFullYear()}-01-01`,
      endDate: `${now.getFullYear()}-12-31`,
      presetRange: "Yearly",
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
