"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import type {
  CashFlowEntry,
  CashFlowFilterState,
  CashFlowSortField,
  CashFlowView,
  CashFlowUrlState,
  GroupedCashFlowEntries,
} from "../types/cash-flow.schema";
import {
  getCashFlowStatement,
  groupCashFlowEntries,
  calculateCashFlowSummary,
} from "../services/cash-flow.service";
import {
  getCashFlowDatePresets,
  getCashFlowDateRangeError,
} from "../utils/reporting-dates";
import {
  createDefaultCashFlowUrlState,
  parseCashFlowUrlState,
  serializeCashFlowUrlState,
} from "../utils/report-state";

type CashFlowReportContext = CashFlowFilterState;

export function useCashFlowStatement() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlSearch = searchParams.toString();
  const urlState = useMemo(
    () => parseCashFlowUrlState(new URLSearchParams(urlSearch)),
    [urlSearch],
  );
  const [datePresets] = useState(() => getCashFlowDatePresets());
  const [viewState, setViewState] = useState<CashFlowUrlState>(urlState);
  const viewStateRef = useRef(viewState);
  viewStateRef.current = viewState;
  const [draftDates, setDraftDates] = useState<CashFlowFilterState>(() => ({
    startDate: urlState.startDate,
    endDate: urlState.endDate,
  }));
  const [report, setReport] = useState<{
    entries: CashFlowEntry[];
    context: CashFlowReportContext | null;
  }>({ entries: [], context: null });
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestGenerationRef = useRef(0);
  const requestControllerRef = useRef<AbortController | null>(null);
  const ownNavigationsRef = useRef(new Set<string>());
  const lastObservedSearchRef = useRef(urlSearch);
  const skipAutomaticLoadRef = useRef<string | null>(null);

  useEffect(() => {
    if (lastObservedSearchRef.current === urlSearch) return;
    lastObservedSearchRef.current = urlSearch;
    if (ownNavigationsRef.current.has(urlSearch)) {
      ownNavigationsRef.current.delete(urlSearch);
      return;
    }

    const next = parseCashFlowUrlState(new URLSearchParams(urlSearch));
    viewStateRef.current = next;
    setViewState(next);
    setDraftDates({ startDate: next.startDate, endDate: next.endDate });
  }, [urlSearch]);

  const writeUrlState = useCallback((next: CashFlowUrlState, mode: "push" | "replace") => {
    const currentSearch = window.location.search.slice(1);
    const nextSearch = serializeCashFlowUrlState(next, currentSearch);
    if (nextSearch === currentSearch) return;

    ownNavigationsRef.current.add(nextSearch);
    const query = nextSearch ? `?${nextSearch}` : "";
    window.history[mode === "push" ? "pushState" : "replaceState"](
      null,
      "",
      `${pathname}${query}${window.location.hash}`,
    );
  }, [pathname]);

  const commitViewState = useCallback((next: CashFlowUrlState, mode: "push" | "replace" = "replace") => {
    viewStateRef.current = next;
    setViewState(next);
    writeUrlState(next, mode);
  }, [writeUrlState]);

  const loadReport = useCallback(async (startDate: string, endDate: string) => {
    const generation = ++requestGenerationRef.current;
    requestControllerRef.current?.abort();
    const controller = new AbortController();
    requestControllerRef.current = controller;
    setIsLoading(true);

    try {
      const data = await getCashFlowStatement({ startDate, endDate, signal: controller.signal });
      if (generation !== requestGenerationRef.current) return false;
      setReport({ entries: data, context: { startDate, endDate } });
      setLastUpdatedAt(new Date());
      setError(null);
      return true;
    } catch (failure) {
      if (controller.signal.aborted || generation !== requestGenerationRef.current) return false;
      const message = failure instanceof Error ? failure.message : "Failed to load cash flow statement.";
      setError(message);
      return false;
    } finally {
      if (generation === requestGenerationRef.current) setIsLoading(false);
    }
  }, []);

  const appliedPeriodKey = `${urlState.startDate}|${urlState.endDate}`;
  useEffect(() => {
    if (skipAutomaticLoadRef.current === appliedPeriodKey) {
      skipAutomaticLoadRef.current = null;
      return;
    }
    void loadReport(urlState.startDate, urlState.endDate);
    return () => {
      requestGenerationRef.current += 1;
      requestControllerRef.current?.abort();
    };
  }, [appliedPeriodKey, loadReport, urlState.endDate, urlState.startDate]);

  const dateRangeError = getCashFlowDateRangeError(draftDates.startDate, draftDates.endDate);
  const appliedContext = report.context ?? {
    startDate: urlState.startDate,
    endDate: urlState.endDate,
  };
  const hasPendingReportChanges = draftDates.startDate !== appliedContext.startDate
    || draftDates.endDate !== appliedContext.endDate;

  const generateReport = useCallback(async (range: CashFlowFilterState = draftDates) => {
    if (getCashFlowDateRangeError(range.startDate, range.endDate)) return false;

    const current = viewStateRef.current;
    const periodChanged = range.startDate !== (report.context?.startDate ?? urlState.startDate)
      || range.endDate !== (report.context?.endDate ?? urlState.endDate);
    const success = await loadReport(range.startDate, range.endDate);
    if (!success) return false;

    const next: CashFlowUrlState = {
      ...current,
      startDate: range.startDate,
      endDate: range.endDate,
      page: periodChanged ? 0 : current.page,
    };
    setDraftDates(range);
    if (`${next.startDate}|${next.endDate}` !== appliedPeriodKey) {
      skipAutomaticLoadRef.current = `${next.startDate}|${next.endDate}`;
    }
    commitViewState(next, periodChanged ? "push" : "replace");
    toast.success("Cash flow statement generated.");
    return true;
  }, [appliedPeriodKey, commitViewState, draftDates, loadReport, report.context, urlState.endDate, urlState.startDate]);

  const updateView = useCallback((updates: Partial<CashFlowUrlState>) => {
    commitViewState({ ...viewStateRef.current, ...updates });
  }, [commitViewState]);

  const setSearch = useCallback((search: string) => {
    updateView({ search, page: 0 });
  }, [updateView]);

  const setActivity = useCallback((activity: CashFlowUrlState["activity"]) => {
    updateView({ activity, page: 0 });
  }, [updateView]);

  const setSort = useCallback((field: CashFlowSortField) => {
    const current = viewStateRef.current;
    updateView({
      sortField: field,
      sortOrder: current.sortField === field && current.sortOrder === "desc" ? "asc" : "desc",
    });
  }, [updateView]);

  const setPage = useCallback((page: number) => updateView({ page }), [updateView]);
  const setPageSize = useCallback((pageSize: CashFlowUrlState["pageSize"]) => updateView({ pageSize, page: 0 }), [updateView]);
  const setView = useCallback((view: CashFlowView) => {
    commitViewState({ ...viewStateRef.current, view }, "push");
  }, [commitViewState]);

  const removeSearch = useCallback(() => setSearch(""), [setSearch]);
  const removeActivity = useCallback(() => setActivity("all"), [setActivity]);

  const removePeriod = useCallback(async () => {
    const defaults = createDefaultCashFlowUrlState();
    setDraftDates({ startDate: defaults.startDate, endDate: defaults.endDate });
    return generateReport({ startDate: defaults.startDate, endDate: defaults.endDate });
  }, [generateReport]);

  const clearAll = useCallback(async () => {
    const defaults = createDefaultCashFlowUrlState();
    const current = viewStateRef.current;
    const resetView = {
      ...defaults,
      startDate: current.startDate,
      endDate: current.endDate,
      view: current.view,
    };
    commitViewState(resetView);
    setDraftDates({ startDate: defaults.startDate, endDate: defaults.endDate });
    return generateReport({ startDate: defaults.startDate, endDate: defaults.endDate });
  }, [commitViewState, generateReport]);

  const refresh = useCallback(() => {
    return loadReport(appliedContext.startDate, appliedContext.endDate);
  }, [appliedContext.endDate, appliedContext.startDate, loadReport]);

  const groupedEntries = useMemo<GroupedCashFlowEntries>(
    () => groupCashFlowEntries(report.entries),
    [report.entries],
  );
  const summary = useMemo(() => calculateCashFlowSummary(report.entries), [report.entries]);

  return {
    entries: report.entries,
    groupedEntries,
    summary,
    isLoading,
    hasLoadedReport: report.context !== null,
    error,
    viewState,
    draftDates,
    appliedContext,
    datePresets,
    dateRangeError,
    hasPendingReportChanges,
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
  };
}
