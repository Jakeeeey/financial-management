"use client";

import React, { useMemo, useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  RefreshCw,
  Download,
  FileText,
  Loader2,
  Calendar,
  TrendingUp,
  AlertCircle,
  ChevronDown,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCashFlowStatement } from "./hooks/useCashFlowStatement";
import { CashFlowSummary } from "./components/CashFlowSummary";
import { CashFlowTable } from "./components/CashFlowTable";
import { CashFlowStatementView } from "./components/CashFlowStatementView";
import { CashFlowAIInsights } from "./components/CashFlowAIInsights";
import { useCashFlowAI } from "./hooks/useCashFlowAI";
import { formatCashFlowDate } from "./utils/reporting-dates";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { CashFlowView } from "./types/cash-flow.schema";
import type { CashFlowExportFormat, CashFlowExportScope } from "./services/cash-flow-export.service";

type ExportState = { scope: CashFlowExportScope; format: CashFlowExportFormat } | null;

type DatePreset = "monthToDate" | "lastMonth" | "yearToDate" | "custom";
const DATE_PRESET_LABELS: Record<DatePreset, string> = {
  monthToDate: "Month to date",
  lastMonth: "Last month",
  yearToDate: "Year to date",
  custom: "Custom period",
};

export default function CashFlowStatementModule() {
  const {
    groupedEntries,
    summary,
    entries,
    isLoading,
    error,
    viewState,
    draftDates,
    appliedContext,
    datePresets,
    dateRangeError,
    hasPendingReportChanges,
    hasLoadedReport,
    lastUpdatedAt,
    setDraftDates,
    generateReport,
    refresh,
    setSearch,
    setActivity,
    setSort,
    setPage,
    setPageSize,
    setView,
    removeSearch,
    removeActivity,
    removePeriod,
    clearAll,
  } = useCashFlowStatement();
  const startDateInputRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState<ExportState>(null);
  const [exportMessage, setExportMessage] = useState("");
  const [exportFailed, setExportFailed] = useState(false);

  const activeDatePreset: DatePreset =
    draftDates.startDate === datePresets.monthToDateStart && draftDates.endDate === datePresets.today
      ? "monthToDate"
      : draftDates.startDate === datePresets.lastMonthStart && draftDates.endDate === datePresets.lastMonthEnd
        ? "lastMonth"
        : draftDates.startDate === datePresets.yearToDateStart && draftDates.endDate === datePresets.today
          ? "yearToDate"
          : "custom";

  const canAnalyzeCashFlow = hasLoadedReport
    && !isLoading
    && !hasPendingReportChanges
    && entries.length > 0;
  const analysisAvailabilityMessage = hasPendingReportChanges
    ? "Generate the pending report dates before analyzing this period."
    : isLoading
      ? "Analysis is unavailable while report data is loading."
      : !hasLoadedReport
        ? "Generate a successful report before running analysis."
        : entries.length === 0
          ? "There are no transactions in this report to analyze."
          : null;

  const aiOptions = useMemo(
    () => ({
      entries,
      summary,
      startDate: appliedContext.startDate,
      endDate: appliedContext.endDate,
      reportGeneratedAt: lastUpdatedAt?.toISOString() ?? null,
      canAnalyze: canAnalyzeCashFlow,
    }),
    [
      entries,
      summary,
      appliedContext.startDate,
      appliedContext.endDate,
      lastUpdatedAt,
      canAnalyzeCashFlow,
    ]
  );

  const {
    insight,
    isAnalyzing,
    error: aiError,
    hasRun,
    analyze: analyzeWithAI,
  } = useCashFlowAI(aiOptions);

  const applyDatePreset = useCallback((preset: Exclude<DatePreset, "custom">) => {
    const ranges = {
      monthToDate: {
        startDate: datePresets.monthToDateStart,
        endDate: datePresets.today,
      },
      lastMonth: {
        startDate: datePresets.lastMonthStart,
        endDate: datePresets.lastMonthEnd,
      },
      yearToDate: {
        startDate: datePresets.yearToDateStart,
        endDate: datePresets.today,
      },
    };
    setDraftDates(ranges[preset]);
  }, [datePresets, setDraftDates]);

  const handleCustomRange = useCallback(() => {
    startDateInputRef.current?.focus();
  }, []);

  const hasTransactionFilters = Boolean(viewState.search.trim()) || viewState.activity !== "all";
  const hasNonDefaultScope = appliedContext.startDate !== datePresets.monthToDateStart
    || appliedContext.endDate !== datePresets.today
    || draftDates.startDate !== datePresets.monthToDateStart
    || draftDates.endDate !== datePresets.today
    || hasTransactionFilters
    || viewState.sortField !== "transactionDate"
    || viewState.sortOrder !== "desc"
    || viewState.page !== 0
    || viewState.pageSize !== 10;
  const lastUpdatedLabel = lastUpdatedAt
    ? new Intl.DateTimeFormat("en-PH", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Manila",
      }).format(lastUpdatedAt)
    : null;
  const reportStatus = isLoading
    ? hasLoadedReport && lastUpdatedLabel
      ? `Refreshing report. Showing the last successful results from ${lastUpdatedLabel} PHT.`
      : "Loading cash flow report."
    : error && !hasLoadedReport
      ? "Cash flow report unavailable."
      : error && lastUpdatedLabel
        ? `Showing the last successful report from ${lastUpdatedLabel} PHT.`
        : lastUpdatedLabel
          ? `Report loaded. Last updated ${lastUpdatedLabel} PHT.`
          : "Report has not loaded yet.";
  const canExport = hasLoadedReport
    && !isLoading
    && !error
    && !hasPendingReportChanges
    && !dateRangeError
    && !exporting;

  const handleExport = useCallback(async (scope: CashFlowExportScope, format: CashFlowExportFormat) => {
    if (!canExport) return;

    const label = scope === "statement" ? "statement" : "all filtered transactions";
    const formatLabel = format === "pdf" ? "PDF" : "Excel";
    setExporting({ scope, format });
    setExportFailed(false);
    setExportMessage(`Generating ${label} ${formatLabel}…`);

    try {
      await new Promise<void>(resolve => window.requestAnimationFrame(() => resolve()));
      const exporter = await import("./services/cash-flow-export.service");
      const context = {
        entries,
        startDate: appliedContext.startDate,
        endDate: appliedContext.endDate,
        search: viewState.search,
        activity: viewState.activity,
        sortField: viewState.sortField,
        sortOrder: viewState.sortOrder,
        generatedAt: new Date(),
      };

      if (format === "pdf") exporter.exportCashFlowToPdf(scope, context);
      else exporter.exportCashFlowToExcel(scope, context);
      setExportMessage(`${label[0].toUpperCase()}${label.slice(1)} ${formatLabel} export generated.`);
    } catch (failure) {
      const detail = failure instanceof Error ? failure.message : "Please try again.";
      setExportFailed(true);
      setExportMessage(`Could not generate ${label} ${formatLabel} export. ${detail}`);
    } finally {
      setExporting(null);
    }
  }, [appliedContext.endDate, appliedContext.startDate, canExport, entries, viewState.activity, viewState.search, viewState.sortField, viewState.sortOrder]);

  const renderExportMenu = (scope: CashFlowExportScope) => {
    const label = scope === "statement" ? "Export statement" : "Export all filtered transactions";
    const activeExport = exporting?.scope === scope;
    return (
      <DropdownMenu key={scope}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canExport}
            aria-busy={activeExport}
            className="h-10 px-4 text-xs font-bold"
          >
            {activeExport ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            {activeExport ? `Generating ${exporting.format === "pdf" ? "PDF" : "Excel"}…` : label}
            {!activeExport && <ChevronDown className="ml-2 h-4 w-4" />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => void handleExport(scope, "pdf")} disabled={!canExport}>
            Export as PDF
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void handleExport(scope, "excel")} disabled={!canExport}>
            Export as Excel
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  return (
    <div className="flex flex-col gap-4 p-3 sm:gap-6 sm:p-6 animate-in fade-in duration-700 max-w-[1600px] mx-auto min-h-screen" style={{ background: 'linear-gradient(180deg, hsl(var(--muted) / 0.15) 0%, transparent 600px)' }}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6 pb-2 border-b border-border/50">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="h-10 w-10 sm:h-14 sm:w-14 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-[0_0_20px_-5px_rgba(16,185,129,0.2)] shrink-0">
            <TrendingUp className="h-5 w-5 sm:h-7 sm:w-7" />
          </div>
          <div>
            <h1 className="text-xl sm:text-3xl font-black uppercase tracking-tight text-foreground">
              Statement of Cash Flows
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground font-medium mt-1 tracking-wide">
              Analyze cash movements across operating, investing, and financing activities
            </p>
          </div>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={refresh}
              disabled={isLoading}
              className="h-10 px-4 text-xs font-bold uppercase tracking-widest bg-background/50 backdrop-blur-sm border-border/50 hover:bg-muted/50 transition-all"
            >
              <RefreshCw className={cn("w-4 h-4 mr-2", isLoading && "animate-spin")} />
              Refresh
            </Button>
            {renderExportMenu("statement")}
            {renderExportMenu("transactions")}
          </div>
          <p className="max-w-[38rem] text-xs text-muted-foreground sm:text-right">
            Statement exports cover the full applied report. Transaction exports include every row matching search and activity filters across all pages.
          </p>
          {exportMessage && (
            <p
              role={exportFailed ? "alert" : "status"}
              aria-live={exportFailed ? "assertive" : "polite"}
              className={cn("text-xs sm:text-right", exportFailed ? "text-destructive" : "text-muted-foreground")}
            >
              {exportMessage}
            </p>
          )}
        </div>
      </div>

      <CashFlowAIInsights
        insight={insight}
        isAnalyzing={isAnalyzing}
        hasRun={hasRun}
        canAnalyze={canAnalyzeCashFlow}
        availabilityMessage={analysisAvailabilityMessage}
        onAnalyze={analyzeWithAI}
        error={aiError}
      />

      {/* Date Range Filter */}
      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-3 sm:p-4">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
            <div className="w-full min-w-0 space-y-1.5">
              <Label htmlFor="cash-flow-start-date" className="text-xs font-medium text-muted-foreground">
                Start date
              </Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="cash-flow-start-date"
                  ref={startDateInputRef}
                  type="date"
                  value={draftDates.startDate}
                  onChange={(e) => setDraftDates((current) => ({ ...current, startDate: e.target.value }))}
                  aria-invalid={Boolean(dateRangeError)}
                  aria-describedby={dateRangeError ? "cash-flow-date-range-error" : undefined}
                  className="pl-10 h-10 text-xs font-bold uppercase bg-muted/30 border-none shadow-none focus-visible:ring-1 focus-visible:ring-emerald-500/30 focus-visible:bg-background rounded-xl transition-all"
                />
              </div>
            </div>
            <div className="w-full min-w-0 space-y-1.5">
              <Label htmlFor="cash-flow-end-date" className="text-xs font-medium text-muted-foreground">
                End date
              </Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="cash-flow-end-date"
                  type="date"
                  value={draftDates.endDate}
                  onChange={(e) => setDraftDates((current) => ({ ...current, endDate: e.target.value }))}
                  max={datePresets.today}
                  aria-invalid={Boolean(dateRangeError)}
                  aria-describedby={dateRangeError ? "cash-flow-date-range-error" : undefined}
                  className="pl-10 h-10 text-xs font-bold uppercase bg-muted/30 border-none shadow-none focus-visible:ring-1 focus-visible:ring-emerald-500/30 focus-visible:bg-background rounded-xl transition-all"
                />
              </div>
            </div>
            <Button
              type="button"
              onClick={() => void generateReport()}
              disabled={Boolean(dateRangeError) || isLoading}
              className="h-10 w-full sm:w-auto sm:min-w-[150px]"
            >
              <RefreshCw className={cn("mr-2 h-4 w-4", isLoading && "animate-spin")} />
              Generate report
            </Button>
          </div>
          <Collapsible defaultOpen={false} className="mt-2">
            <CollapsibleTrigger asChild>
              <Button type="button" variant="ghost" size="sm" className="group h-8 px-1 text-xs text-muted-foreground">
                <span>Period shortcuts</span>
                <span className="text-foreground">({DATE_PRESET_LABELS[activeDatePreset]})</span>
                <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <div className="flex flex-wrap gap-2" role="group" aria-label="Reporting period shortcuts">
              <Button
                variant="outline"
                size="sm"
                onClick={() => applyDatePreset("monthToDate")}
                aria-pressed={activeDatePreset === "monthToDate"}
                className={cn("h-10 px-4 text-[10px] font-black uppercase tracking-widest", activeDatePreset === "monthToDate" && "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300")}
              >
                Month to date
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => applyDatePreset("lastMonth")}
                aria-pressed={activeDatePreset === "lastMonth"}
                className={cn("h-10 px-4 text-[10px] font-black uppercase tracking-widest", activeDatePreset === "lastMonth" && "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300")}
              >
                Last month
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => applyDatePreset("yearToDate")}
                aria-pressed={activeDatePreset === "yearToDate"}
                className={cn("h-10 px-4 text-[10px] font-black uppercase tracking-widest", activeDatePreset === "yearToDate" && "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300")}
              >
                Year to date
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCustomRange}
                aria-pressed={activeDatePreset === "custom"}
                className={cn("h-10 px-4 text-[10px] font-black uppercase tracking-widest", activeDatePreset === "custom" && "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300")}
              >
                Custom
              </Button>
              </div>
            </CollapsibleContent>
          </Collapsible>
          {dateRangeError && (
            <p
              id="cash-flow-date-range-error"
              role="alert"
              className="mt-3 text-sm font-medium text-rose-600 dark:text-rose-400"
            >
              {dateRangeError}
            </p>
          )}
          {(hasPendingReportChanges || !hasLoadedReport) && <div className="mt-2 flex flex-col gap-2 border-t border-border/50 pt-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {hasPendingReportChanges
                ? "Changes pending — Generate report to apply."
                : hasLoadedReport
                  ? `Applied report: ${formatCashFlowDate(appliedContext.startDate)} – ${formatCashFlowDate(appliedContext.endDate)}`
                  : "Choose a reporting period and generate the report."}
            </p>
          </div>}
        </CardContent>
      </Card>

      {!dateRangeError && (hasPendingReportChanges || !hasLoadedReport) && (
        <p className="-mt-4 text-sm text-muted-foreground" aria-live="polite">
          <span className="font-semibold text-foreground">Selected period ({DATE_PRESET_LABELS[activeDatePreset]}):</span>{" "}
          {formatCashFlowDate(draftDates.startDate)} – {formatCashFlowDate(draftDates.endDate)}
          {hasPendingReportChanges && <span className="font-medium text-amber-700 dark:text-amber-300"> · Not applied</span>}
        </p>
      )}

      <div className="flex flex-col gap-1 rounded-lg border border-border/50 bg-background/70 p-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:p-3">
        <div>
          <p className="text-xs font-semibold sm:text-sm">Applied report scope</p>
          <p className="text-xs text-muted-foreground sm:text-sm" aria-live="polite">
            {formatCashFlowDate(appliedContext.startDate)} – {formatCashFlowDate(appliedContext.endDate)}
          </p>
        </div>
        <p className="text-xs text-muted-foreground" role="status" aria-live="polite" aria-atomic="true">
          {reportStatus}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-1.5" aria-label="Applied report and transaction filters">
        <span className="mr-1 text-xs text-muted-foreground">Applied report period:</span>
        <Button type="button" variant="outline" size="sm" className="h-8 gap-2" onClick={() => void removePeriod()} disabled={isLoading}>
          Period: {formatCashFlowDate(appliedContext.startDate)} – {formatCashFlowDate(appliedContext.endDate)}
          <X className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="sr-only">Reset period to month to date and regenerate</span>
        </Button>
        {hasTransactionFilters && <span className="ml-2 mr-1 text-xs text-muted-foreground">Transactions view:</span>}
        {viewState.search.trim() && (
          <Button type="button" variant="outline" size="sm" className="h-8 gap-2" onClick={removeSearch}>
            Search: {viewState.search}
            <X className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="sr-only">Remove search filter</span>
          </Button>
        )}
        {viewState.activity !== "all" && (
          <Button type="button" variant="outline" size="sm" className="h-8 gap-2 capitalize" onClick={removeActivity}>
            Activity: {viewState.activity === "uncategorized" ? "Uncategorized" : viewState.activity}
            <X className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="sr-only">Remove activity filter</span>
          </Button>
        )}
        <Button type="button" variant="ghost" size="sm" className="ml-auto" onClick={() => void clearAll()} disabled={!hasNonDefaultScope || isLoading}>
          Clear all
        </Button>
      </div>

      {/* Error State */}
      {error && (
        <Card className="border-rose-500/50 bg-rose-50 dark:bg-rose-950/20">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-rose-500 shrink-0" />
            <p role="alert" className="flex-1 text-sm font-medium text-rose-600 dark:text-rose-400">
              {isLoading
                ? hasLoadedReport ? "Retrying. The last successful report remains visible. " : "Retrying the report request. "
                : hasLoadedReport ? "Refresh failed. The last successful report is still shown. " : "The report could not be loaded. "}
              {error}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void (hasPendingReportChanges ? generateReport() : refresh())}
              disabled={isLoading}
            >
              {isLoading ? "Retrying…" : "Retry"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="-mt-1" aria-busy={isLoading}>
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide">Full-report totals</h2>
        <p className="mb-2 text-xs text-muted-foreground">These figures cover all report transactions in the applied period. Search and activity filters affect only the Transactions view.</p>
        {!hasLoadedReport && !isLoading ? (
          <p role="status" className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">Report totals are unavailable until the report loads.</p>
        ) : (
          <CashFlowSummary
            operatingActivities={summary.operatingActivities}
            investingActivities={summary.investingActivities}
            financingActivities={summary.financingActivities}
            netIncreaseInCash={summary.netIncreaseInCash}
            uncategorizedCount={summary.uncategorizedCount}
            uncategorizedNetMovement={summary.uncategorizedNetMovement}
            registerNetMovement={summary.registerNetMovement}
            reconciliationDifference={summary.reconciliationDifference}
            isLoading={isLoading && !hasLoadedReport}
          />
        )}
      </div>

      {/* Statement and transaction views */}
      <Card className="border-border/50 shadow-sm" aria-busy={isLoading}>
        <CardContent className="p-3 sm:p-6">
          <div className="mb-3 flex items-center gap-3 sm:mb-4">
            <FileText className="h-5 w-5 text-emerald-500" />
            <h2 className="text-base font-bold uppercase tracking-tight sm:text-lg">Report details</h2>
          </div>
          <Tabs
            value={viewState.view}
            onValueChange={(view) => setView(view as CashFlowView)}
            className="w-full min-w-0 gap-3"
          >
            <TabsList className="grid w-full grid-cols-2 sm:w-fit">
              <TabsTrigger value="statement">Statement</TabsTrigger>
              <TabsTrigger value="transactions">Transactions</TabsTrigger>
            </TabsList>
            <TabsContent value="statement" className="mt-0">
              <CashFlowStatementView
                groupedEntries={groupedEntries}
                entriesCount={entries.length}
                summary={summary}
                startDate={appliedContext.startDate}
                endDate={appliedContext.endDate}
                isLoading={isLoading}
                hasLoadedReport={hasLoadedReport}
              />
            </TabsContent>
            <TabsContent value="transactions" className="mt-0">
              <div className="mb-3">
                <h3 className="font-semibold">Transaction register</h3>
                <p className="text-xs text-muted-foreground">
                  Search and activity filters narrow this register only; full-report totals above remain unchanged.
                </p>
              </div>
              <CashFlowTable
                groupedEntries={groupedEntries}
                isLoading={isLoading && !hasLoadedReport}
                hasLoadedReport={hasLoadedReport}
                appliedStartDate={appliedContext.startDate}
                appliedEndDate={appliedContext.endDate}
                search={viewState.search}
                activity={viewState.activity}
                sortField={viewState.sortField}
                sortOrder={viewState.sortOrder}
                page={viewState.page}
                pageSize={viewState.pageSize}
                onSearchChange={setSearch}
                onActivityChange={setActivity}
                onSortChange={setSort}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

    </div>
  );
}
