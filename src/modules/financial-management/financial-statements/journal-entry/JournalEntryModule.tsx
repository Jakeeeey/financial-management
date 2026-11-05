"use client";

import * as React from "react";
import { toast } from "sonner";
import { FileDown, Loader2, Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";

import { cn } from "@/lib/utils";
import { FilterState, HighRiskEntry, JournalEntryGroup } from "./types";
import { useJournalEntries } from "./hooks/useJournalEntries";
import { JournalEntryProvider } from "./providers/JournalEntryProvider";
import { createDefaultFilterState, normalizeFilterDates } from "./utils/filter-state";

import SummaryCards, { SecondarySummaryCards } from "./components/SummaryCards";
import FilterPanel from "./components/FilterPanel";
import JournalEntryFilterToolbar from "./components/JournalEntryFilterToolbar";
import RiskInsights from "./components/RiskInsights";
import JournalEntryTable from "./components/JournalEntryTable";
import JournalEntryDetailModal from "./components/JournalEntryDetailModal";
import { getAppliedFilterChips, type AppliedFilterKey } from "./utils/applied-filter-chips";

import { DataTableSkeleton } from "@/app/(financial-management)/fm/_components/DataTableSkeleton";
import { ErrorPage } from "@/app/(financial-management)/fm/_components/ErrorPage";

/**
 * Main module component that provides the context for all sub-components.
 * Follows the standard Provider Pattern for consistent state management.
 */
export default function JournalEntryModule() {
  return (
    <JournalEntryProvider>
      <JournalEntryDashboard />
    </JournalEntryProvider>
  );
}

function JournalEntryDashboard() {
  const { 
    paginatedGroups,
    analytics,
    analyticsLoading,
    analyticsError,
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
    pageCount,
    totalGroupCount,
    setCurrentPage,
    setPageSize,
    viewRevision,
  } = useJournalEntries();

  const [draftFilters, setDraftFilters] = React.useState(filters);
  const appliedFiltersRef = React.useRef(filters);
  appliedFiltersRef.current = filters;
  const [selectedGroup, setSelectedGroup] = React.useState<JournalEntryGroup | null>(null);
  const [isDetailOpen, setIsDetailOpen] = React.useState(false);
  const [isExporting, setIsExporting] = React.useState<"PDF" | "Excel" | null>(null);
  const resultsScrollRef = React.useRef<HTMLDivElement>(null);
  const detailOpenerRef = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    setDraftFilters(appliedFiltersRef.current);
  }, [viewRevision]);

  const applyDraftFilters = () => {
    const normalizedFilters = normalizeFilterDates(draftFilters);
    setDraftFilters(normalizedFilters);
    setFilters(normalizedFilters);
    setCurrentPage(0);
  };

  const resetAllFilters = () => {
    resetFilters();
    setDraftFilters(createDefaultFilterState());
  };

  const removeAppliedFilter = (key: AppliedFilterKey) => {
    const defaults = createDefaultFilterState();
    const resetValues: Partial<FilterState> = key === "period"
      ? {
          presetRange: defaults.presetRange,
          selectedMonth: defaults.selectedMonth,
          selectedQuarter: defaults.selectedQuarter,
          selectedYear: defaults.selectedYear,
          startDate: defaults.startDate,
          endDate: defaults.endDate,
        }
      : { [key]: defaults[key] };

    setFilters((current) => ({ ...current, ...resetValues }));
    setDraftFilters((current) => ({ ...current, ...resetValues }));
    setCurrentPage(0);
  };

  const exportControllerRef = React.useRef<AbortController | null>(null);
  React.useEffect(() => () => {
    exportControllerRef.current?.abort();
    exportControllerRef.current = null;
  }, []);

  const handleExport = async (type: "PDF" | "Excel") => {
    if (exportControllerRef.current) return;
    const controller = new AbortController();
    exportControllerRef.current = controller;
    setIsExporting(type);
    const toastId = toast.loading(`Preparing ${type} export of all filtered journals...`);
    try {
      const query = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) query.set(key, String(value));
      });
      const extension = type === "PDF" ? "pdf" : "xlsx";
      query.set("format", extension);
      query.set("timeZone", Intl.DateTimeFormat().resolvedOptions().timeZone);
      const response = await fetch(`/api/fm/financial-statements/journal-entry/export?${query}`, { signal: controller.signal, cache: "no-store" });
      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.error || `Unable to export ${type}. Please retry.`);
      }
      const blob = await response.blob();
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(blob);
      try {
        const link = document.createElement("a");
        link.href = url;
        link.download = `General_Journal_Export.${extension}`;
        document.body.appendChild(link);
        link.click();
        link.remove();
      } finally {
        window.setTimeout(() => URL.revokeObjectURL(url), 0);
      }
      toast.success(`${type} exported successfully!`, { id: toastId });
    } catch (error) {
      if (!controller.signal.aborted) toast.error(error instanceof Error ? error.message : `Failed to export ${type}`, { id: toastId });
    } finally {
      if (controller.signal.aborted) toast.dismiss(toastId);
      if (exportControllerRef.current === controller) {
        exportControllerRef.current = null;
        setIsExporting(null);
      }
    }
  };

  const handleSort = (field: string) => {
    const sortOrder = filters.sortField === field && filters.sortOrder === "asc" ? "desc" : "asc";
    setFilters(prev => ({
        ...prev,
        sortField: field,
        sortOrder,
    }));
    setDraftFilters((current) => ({ ...current, sortField: field, sortOrder }));
    setCurrentPage(0);
  };

  const openJournalDetails = (group: JournalEntryGroup, opener: HTMLElement) => {
    detailOpenerRef.current = opener;
    setSelectedGroup(group);
    setIsDetailOpen(true);
  };

  const restoreDetailFocus = () => {
    const opener = detailOpenerRef.current;
    detailOpenerRef.current = null;

    if (opener?.isConnected) {
      opener.focus();
      return;
    }

    resultsScrollRef.current?.focus();
  };

  const openRiskJournal = async (riskEntry: HighRiskEntry, opener: HTMLElement) => {
    let group = paginatedGroups.find((item) =>
      item.jeNo === riskEntry.jeNo && item.jeGroupCounter === riskEntry.jeGroupCounter
    );

    if (!group) {
      const query = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) query.set(key, String(value));
      });
      query.set("search", riskEntry.jeNo);
      query.set("pageSize", "50");

      let page = 0;
      let totalPages = 1;
      while (page < totalPages && !group) {
        query.set("page", String(page));
        const response = await fetch(`/api/fm/financial-statements/journal-entry?${query.toString()}`, { cache: "no-store" });
        if (!response.ok) throw new Error("Journal lookup request failed.");

        const payload = await response.json() as {
          data?: JournalEntryGroup[];
          metadata?: { totalPages?: number };
        };
        group = payload.data?.find((item) =>
          item.jeNo === riskEntry.jeNo && item.jeGroupCounter === riskEntry.jeGroupCounter
        );

        const nextTotalPages = Number(payload.metadata?.totalPages ?? 0);
        totalPages = Number.isFinite(nextTotalPages) ? Math.max(0, nextTotalPages) : 0;
        page += 1;
      }
    }

    if (!group) throw new Error("The flagged journal entry could not be found.");
    openJournalDetails(group, opener);
  };

  const hasPendingChanges = JSON.stringify(draftFilters) !== JSON.stringify(filters);
  const statusOptions = Array.from(new Set([
    ...Object.keys(analytics.statusBreakdown || {}),
    filters.status,
  ]));
  const appliedFilterChips = getAppliedFilterChips(filters, filterOptions);

  if (error) {
    return <ErrorPage message={error} onRefresh={refresh} />;
  }

  return (
    <div className="flex flex-col h-full bg-muted/10 overflow-hidden">
      {/* Header Section */}
      <div className="bg-background px-6 py-4 border-b flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 shadow-sm">
        <div>
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
             Journal Entry Analysis
             <Badge variant="secondary" className="text-xs uppercase font-medium py-0 h-4">Analytics Dashboard</Badge>
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Real-time audit, validation, and multi-line accounting distribution tracking.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="outline" size="sm" className="h-9 text-sm" onClick={() => handleExport("PDF")} disabled={isExporting !== null}>
                {isExporting === "PDF" ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Printer className="mr-2 h-3.5 w-3.5" />}
                {isExporting === "PDF" ? "Exporting PDF…" : "Export all filtered (PDF)"}
            </Button>
            <Button size="sm" className="h-9 text-sm shadow-md" onClick={() => handleExport("Excel")} disabled={isExporting !== null}>
                {isExporting === "Excel" ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <FileDown className="mr-2 h-3.5 w-3.5" />}
                {isExporting === "Excel" ? "Exporting Excel…" : "Export all filtered (Excel)"}
            </Button>
          </div>
          <p className="text-right text-xs text-muted-foreground">Exports include all journals matching applied filters across every page.</p>
        </div>
      </div>

      <JournalEntryFilterToolbar
        filters={draftFilters}
        setFilters={setDraftFilters}
        hasPendingChanges={hasPendingChanges}
        onApply={applyDraftFilters}
        onReset={resetAllFilters}
      />

      <div ref={resultsScrollRef} tabIndex={-1} className="min-h-0 min-w-0 flex-1 overflow-y-auto custom-scrollbar">
        <FilterPanel
          filters={draftFilters}
          setFilters={setDraftFilters}
          uniqueSourceModules={uniqueSourceModules}
          statusOptions={statusOptions}
          filterOptions={filterOptions}
          filterOptionsLoading={filterOptionsLoading}
          filterOptionsError={filterOptionsError}
        />

        {/* Results remain vertically scrollable; the table owns horizontal scrolling. */}
        <div className="space-y-6 px-3 py-3 sm:px-6 sm:py-6">
          {appliedFilterChips.length > 0 && (
            <div aria-label="Applied filters" className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground">Applied filters:</span>
              {appliedFilterChips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => removeAppliedFilter(chip.key)}
                  aria-label={`Remove ${chip.label} filter`}
                  className="inline-flex max-w-full items-center gap-1 rounded-full border bg-background px-2.5 py-1 text-xs text-foreground hover:bg-muted"
                >
                  <span className="truncate">{chip.label}</span>
                  <X aria-hidden="true" className="h-3 w-3 shrink-0" />
                </button>
              ))}
              <span className="sr-only" aria-live="polite">{appliedFilterChips.length} filters applied</span>
            </div>
          )}

          {/* Summary Stats */}
          {analyticsError ? (
            <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
              <p>{analyticsError}</p>
              <Button variant="outline" size="sm" onClick={() => void refreshAnalytics()}>Retry analytics</Button>
            </div>
          ) : <SummaryCards data={analytics} loading={analyticsLoading} />}

          <section aria-labelledby="journal-more-analytics" className="min-w-0 space-y-4">
            <div className="rounded-lg border bg-card px-4 py-3 shadow-sm">
              <h2 id="journal-more-analytics" className="text-sm font-semibold">More analytics</h2>
              <p className="text-xs text-muted-foreground">Secondary metrics, status breakdown, and high-risk entries</p>
            </div>
            {!analyticsError && <SecondarySummaryCards data={analytics} loading={analyticsLoading} />}
            {!analyticsLoading && !analyticsError && <RiskInsights data={analytics} onOpenJournal={openRiskJournal} />}
          </section>

          {/* Grouped Table with Loading State */}
          {isLoading ? (
              <DataTableSkeleton columnCount={13} rowCount={10} />
          ) : (
              <JournalEntryTable 
                groups={paginatedGroups} 
                loading={isLoading}
                onDrillDown={openJournalDetails}
                currentPage={currentPage}
                pageSize={pageSize}
                pageCount={pageCount}
                totalGroupCount={totalGroupCount}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
                startDate={filters.startDate}
                endDate={filters.endDate}
                sortField={filters.sortField}
                sortOrder={filters.sortOrder}
                onSort={handleSort}
              />
          )}
        </div>
      </div>

      <JournalEntryDetailModal 
        group={selectedGroup}
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        onRestoreFocus={restoreDetailFocus}
      />
    </div>
  );
}

// Inline Badge for local use if UI component is not globally exposed in index
function Badge({ variant = "default", className = "", children }: { variant?: "default" | "secondary" | "outline", className?: string, children?: React.ReactNode }) {
    const variants: Record<string, string> = {
        default: "bg-primary text-primary-foreground",
        secondary: "bg-secondary text-secondary-foreground",
        outline: "border border-input bg-background",
    };
    return (
        <span className={cn(
            "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            variants[variant],
            className
        )}>
            {children}
        </span>
    );
}
