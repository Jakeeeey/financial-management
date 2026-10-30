"use client";

import * as React from "react";
import { toast } from "sonner";
import { FileDown, Loader2, Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";

import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { FilterState, HighRiskEntry, JournalEntryFilterOption, JournalEntryGroup, JournalEntryFilterOptions } from "./types";
import { useJournalEntries } from "./hooks/useJournalEntries";
import { JournalEntryProvider } from "./providers/JournalEntryProvider";
import { createDefaultFilterState, normalizeFilterDates } from "./utils/filter-state";

import SummaryCards, { SecondarySummaryCards } from "./components/SummaryCards";
import FilterPanel from "./components/FilterPanel";
import JournalEntryFilterToolbar from "./components/JournalEntryFilterToolbar";
import RiskInsights from "./components/RiskInsights";
import JournalEntryTable from "./components/JournalEntryTable";
import JournalEntryDetailModal from "./components/JournalEntryDetailModal";
import { exportJournalToExcel, exportJournalToPdf } from "./services/export.service";

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

  const handleExport = async (type: "PDF" | "Excel") => {
    if (isExporting) return;

    setIsExporting(type);
    const formattedStart = format(new Date(filters.startDate), "MMM d, yyyy");
    const formattedEnd = format(new Date(filters.endDate), "MMM d, yyyy");
    const dateRangeText = `${formattedStart} to ${formattedEnd}`;
    const toastId = toast.loading(`Preparing ${type} export of all filtered journals...`);

    try {
      const query = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) query.set(key, value.toString());
      });
      query.set("pageSize", "100000");

      const allGroups: JournalEntryGroup[] = [];
      let totalPages = 1;
      let totalGroups = 0;

      for (let page = 0; page < totalPages; page += 1) {
        query.set("page", String(page));
        const res = await fetch(`/api/fm/financial-statements/journal-entry?${query.toString()}`);
        if (!res.ok) throw new Error("Failed to fetch data for export");

        const response = await res.json() as {
          data?: JournalEntryGroup[];
          metadata?: { totalPages?: number; totalGroups?: number };
        };
        const metadata = response.metadata;
        if (
          !Array.isArray(response.data)
          || !metadata
          || !Number.isInteger(metadata.totalPages)
          || !Number.isInteger(metadata.totalGroups)
        ) {
          throw new Error("The export response was incomplete.");
        }

        if (page === 0) {
          totalPages = Math.max(0, metadata.totalPages ?? 0);
          totalGroups = Math.max(0, Number(metadata.totalGroups ?? 0));
        }

        allGroups.push(...response.data);
        toast.loading(`Preparing ${type} export: ${allGroups.length} of ${totalGroups} journals...`, { id: toastId });
      }

      if (allGroups.length !== totalGroups) {
        throw new Error("The export did not include all matching journals.");
      }

      const activeFilters = getAppliedFilterChips(filters, filterOptions)
        .filter((chip) => chip.key !== "period")
        .map((chip) => chip.label);

      toast.loading(`Generating ${type} report...`, { id: toastId });
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));

      if (type === "Excel") {
        exportJournalToExcel(allGroups, dateRangeText, "General_Journal_Export.xlsx", activeFilters);
        toast.success("Excel exported successfully!", { id: toastId });
      } else {
        exportJournalToPdf(allGroups, dateRangeText, "General_Journal_Export.pdf", activeFilters);
        toast.success("PDF exported successfully!", { id: toastId });
      }
    } catch (err) {
      console.error("Export Error:", err);
      toast.error(`Failed to export ${type}`, { id: toastId });
    } finally {
      setIsExporting(null);
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
          <SummaryCards data={analytics} loading={isLoading} />

          <section aria-labelledby="journal-more-analytics" className="min-w-0 space-y-4">
            <div className="rounded-lg border bg-card px-4 py-3 shadow-sm">
              <h2 id="journal-more-analytics" className="text-sm font-semibold">More analytics</h2>
              <p className="text-xs text-muted-foreground">Secondary metrics, status breakdown, and high-risk entries</p>
            </div>
            <SecondarySummaryCards data={analytics} loading={isLoading} />
            {!isLoading && <RiskInsights data={analytics} onOpenJournal={openRiskJournal} />}
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

type AppliedFilterKey = "search" | "period" | "entryType" | "status" | "branch" | "division" | "department" | "sourceModule" | "coa" | "accountNumber";

function getAppliedFilterChips(filters: FilterState, options: JournalEntryFilterOptions) {
  const chips: { key: AppliedFilterKey; label: string }[] = [];
  const now = new Date();
  const currentMonthStart = format(new Date(now.getFullYear(), now.getMonth(), 1), "yyyy-MM-dd");
  const currentMonthEnd = format(new Date(now.getFullYear(), now.getMonth() + 1, 0), "yyyy-MM-dd");
  const isDefaultPeriod = filters.presetRange === "Monthly"
    && filters.selectedMonth === now.getMonth()
    && filters.selectedYear === now.getFullYear()
    && filters.startDate.slice(0, 10) === currentMonthStart
    && filters.endDate.slice(0, 10) === currentMonthEnd;

  if (filters.search.trim()) chips.push({ key: "search", label: `Search: ${filters.search.trim()}` });
  if (!isDefaultPeriod) {
    const period = filters.presetRange === "Custom"
      ? `${format(new Date(filters.startDate), "MMM d, yyyy")} – ${format(new Date(filters.endDate), "MMM d, yyyy")}`
      : filters.presetRange === "Monthly"
        ? format(new Date(filters.selectedYear, filters.selectedMonth, 1), "MMMM yyyy")
        : filters.presetRange === "Quarterly"
          ? `Q${filters.selectedQuarter} ${filters.selectedYear}`
          : String(filters.selectedYear);
    chips.push({ key: "period", label: `Period: ${period}` });
  }
  if (filters.status !== "All Statuses") chips.push({ key: "status", label: `Status: ${filters.status}` });

  const addLookupChip = (key: "branch" | "division" | "department", allLabel: string, label: string, lookup: JournalEntryFilterOption[]) => {
    if (filters[key] === allLabel) return;
    const option = lookup.find((item) => item.id === filters[key]);
    chips.push({ key, label: `${label}: ${option?.name ?? filters[key]}` });
  };

  addLookupChip("branch", "All Branches", "Branch", options.branches);
  addLookupChip("division", "All Divisions", "Division", options.divisions);
  addLookupChip("department", "All Departments", "Department", options.departments);
  if (filters.entryType && filters.entryType !== "All Entry Types") chips.push({ key: "entryType", label: `Type: ${filters.entryType}` });
  if (filters.sourceModule !== "All Source Modules") chips.push({ key: "sourceModule", label: `Source: ${filters.sourceModule}` });
  if (filters.coa !== "All Accounts") chips.push({ key: "coa", label: `Account: ${filters.coa}` });
  if (filters.accountNumber) chips.push({ key: "accountNumber", label: `Account no.: ${filters.accountNumber}` });
  return chips;
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
