"use client";

import { useJournalEntryContext } from "../providers/JournalEntryProvider";

/**
 * Standardized client-side hook for accessing the journal entry data and state.
 * This abstracts the underlying provider and provides a clean interface for UI components.
 */
export function useJournalEntries() {
  const context = useJournalEntryContext();
  
  return {
    // Data
    entries: context.entries,
    groups: context.filteredGroups,
    paginatedGroups: context.paginatedGroups,
    analytics: context.analytics,
    
    // State
    filters: context.filters,
    setFilters: context.setFilters,
    isLoading: context.isLoading,
    error: context.error,
    
    // Pagination
    currentPage: context.currentPage,
    pageSize: context.pageSize,
    pageCount: context.pageCount,
    totalGroupCount: context.totalGroupCount,
    setCurrentPage: context.setCurrentPage,
    setPageSize: context.setPageSize,
    
    // Actions
    refresh: context.refresh,
    resetFilters: context.resetFilters,
  };
}
