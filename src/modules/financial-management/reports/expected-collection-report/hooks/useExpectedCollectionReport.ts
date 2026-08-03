"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addDays,
  currentManilaWeek,
  formatDateOnly,
  parseDateOnly,
  weekFromDate,
  weekFromStart,
  weekdayLabel,
} from "../utils/date";
import {
  EMPTY_FILTERS,
  type ExpectedCollectionFilters,
  type ExpectedCollectionRecord,
  type ExpectedCollectionResponse,
  type FilterOptions,
  type SalesmanCollectionGroup,
  type WeekRange,
} from "../types";

const REPORT_ENDPOINT = "/api/fm/reports/expected-collection-report";

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function displayName(value: string | null, fallback: string): string {
  return value?.trim() || fallback;
}

function compareInvoices(left: ExpectedCollectionRecord, right: ExpectedCollectionRecord): number {
  const dueDateComparison = (left.dueDate || "9999-12-31").localeCompare(right.dueDate || "9999-12-31");
  return dueDateComparison || left.invoiceNo.localeCompare(right.invoiceNo);
}

function filterRecords(
  records: ExpectedCollectionRecord[],
  filters: ExpectedCollectionFilters,
): ExpectedCollectionRecord[] {
  const customerQuery = filters.customerName.trim().toLowerCase();
  const invoiceQuery = filters.invoiceNo.trim().toLowerCase();

  return records.filter((record) => {
    const matchesDivision = !filters.division || displayName(record.division, "Unassigned Division") === filters.division;
    const matchesSalesman = !filters.salesman || displayName(record.salesman, "Unassigned Salesman") === filters.salesman;
    const matchesInvoice = !invoiceQuery || record.invoiceNo.toLowerCase().includes(invoiceQuery);
    const matchesCustomer = !customerQuery
      || record.customerName.toLowerCase().includes(customerQuery)
      || record.customerCode.toLowerCase().includes(customerQuery);

    return matchesDivision && matchesSalesman && matchesInvoice && matchesCustomer;
  });
}

function buildGroups(records: ExpectedCollectionRecord[], range: WeekRange | null): SalesmanCollectionGroup[] {
  const grouped = new Map<string, ExpectedCollectionRecord[]>();

  records.forEach((record) => {
    const name = displayName(record.salesman, "Unassigned Salesman");
    const existing = grouped.get(name) || [];
    existing.push(record);
    grouped.set(name, existing);
  });

  return Array.from(grouped.entries())
    .map(([name, groupRecords]) => {
      const dailyOutstanding = range
        ? Array.from({ length: 7 }, (_, index) => {
          const date = formatDateOnly(addDays(parseDateOnly(range.startDate)!, index));
          return {
            date,
            label: weekdayLabel(date),
            amount: groupRecords
              .filter((record) => record.dueDate === date)
              .reduce((sum, record) => sum + record.outstandingBalance, 0),
          };
        })
        : [];

      return {
        name,
        records: [...groupRecords].sort(compareInvoices),
        invoiceCount: groupRecords.length,
        customerCount: new Set(groupRecords.map((record) => record.customerCode || record.customerName)).size,
        divisions: Array.from(new Set(groupRecords.map((record) => displayName(record.division, "Unassigned Division")))).sort(),
        outstandingBalance: groupRecords.reduce((sum, record) => sum + record.outstandingBalance, 0),
        dailyOutstanding,
      };
    })
    .sort((left, right) => right.outstandingBalance - left.outstandingBalance || left.name.localeCompare(right.name));
}

export function useExpectedCollectionReport() {
  const [range, setRange] = useState<WeekRange | null>(null);
  const [records, setRecords] = useState<ExpectedCollectionRecord[]>([]);
  const [filters, setFilters] = useState<ExpectedCollectionFilters>(EMPTY_FILTERS);
  const [showAllInvoices, setShowAllInvoices] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

  const load = useCallback(async (
    requestedRange?: WeekRange,
    allInvoices = false,
    resetFilters = true,
  ) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const requestId = ++requestIdRef.current;

    setLoading(true);
    setError(null);
    setShowAllInvoices(allInvoices);
    if (resetFilters) setFilters(EMPTY_FILTERS);

    const params = allInvoices
      ? "?all=true"
      : requestedRange
      ? `?startDate=${encodeURIComponent(requestedRange.startDate)}&endDate=${encodeURIComponent(requestedRange.endDate)}`
      : "";

    try {
      const response = await fetch(`${REPORT_ENDPOINT}${params}`, {
        credentials: "include",
        cache: "no-store",
        signal: controller.signal,
      });

      const payload = await response.json().catch(() => null) as ExpectedCollectionResponse | { message?: string } | null;
      if (!response.ok) {
        throw new Error(payload && "message" in payload && payload.message
          ? payload.message
          : `Report request failed with status ${response.status}.`);
      }

      if (!payload || !("range" in payload) || !Array.isArray(payload.records)) {
        throw new Error("The report returned an invalid response.");
      }

      if (requestId !== requestIdRef.current) return;
      setRange(payload.range);
      setShowAllInvoices(payload.allInvoices);
      setRecords(payload.records);
    } catch (requestError) {
      if (isAbortError(requestError) || requestId !== requestIdRef.current) return;
      setError(requestError instanceof Error ? requestError.message : "Unable to load the report.");
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    return () => abortRef.current?.abort();
  }, [load]);

  const filteredRecords = useMemo(() => filterRecords(records, filters), [records, filters]);

  const filterOptions = useMemo<FilterOptions>(() => ({
    divisions: Array.from(new Set(records.map((record) => displayName(record.division, "Unassigned Division")))).sort(),
    salesmen: Array.from(new Set(records.map((record) => displayName(record.salesman, "Unassigned Salesman")))).sort(),
  }), [records]);

  const salesmanGroups = useMemo(
    () => buildGroups(filteredRecords, range),
    [filteredRecords, range],
  );

  const hasActiveFilters = Boolean(
    filters.division || filters.salesman || filters.customerName.trim() || filters.invoiceNo.trim(),
  );

  const navigateToWeek = useCallback((nextStartDate: string) => {
    const nextRange = weekFromStart(nextStartDate);
    if (nextRange) void load(nextRange, false);
  }, [load]);

  const previousWeek = useCallback(() => {
    if (!range || showAllInvoices) return;
    const start = parseDateOnly(range.startDate);
    if (start) navigateToWeek(formatDateOnly(addDays(start, -7)));
  }, [navigateToWeek, range, showAllInvoices]);

  const nextWeek = useCallback(() => {
    if (!range || showAllInvoices) return;
    const start = parseDateOnly(range.startDate);
    if (start) navigateToWeek(formatDateOnly(addDays(start, 7)));
  }, [navigateToWeek, range, showAllInvoices]);

  const selectDate = useCallback((value: string) => {
    const date = parseDateOnly(value);
    if (date) navigateToWeek(weekFromDate(date).startDate);
  }, [navigateToWeek]);

  const selectEndDate = useCallback((value: string) => {
    const date = parseDateOnly(value);
    if (date) navigateToWeek(weekFromDate(date).startDate);
  }, [navigateToWeek]);

  const resetToCurrentWeek = useCallback(() => {
    void load(currentManilaWeek(), false, false);
  }, [load]);

  const toggleAllInvoices = useCallback((value: boolean) => {
    if (value) void load(undefined, true, false);
    else void load(currentManilaWeek(), false, false);
  }, [load]);

  return {
    range,
    showAllInvoices,
    records,
    filteredRecords,
    filters,
    setFilters,
    filterOptions,
    salesmanGroups,
    hasActiveFilters,
    loading,
    error,
    previousWeek,
    nextWeek,
    selectDate,
    selectEndDate,
    resetToCurrentWeek,
    toggleAllInvoices,
    clearFilters: () => setFilters(EMPTY_FILTERS),
  };
}
