"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  currentManilaDateOnly,
  dateRangeForPeriod,
  datesInRange,
  shiftReferenceDate,
  weekdayLabel,
} from "../utils/date";
import {
  EMPTY_FILTERS,
  type ExpectedCollectionFilters,
  type ExpectedCollectionRecord,
  type ExpectedCollectionResponse,
  type FilterOptions,
  type DateRange,
  type ReportPeriod,
  type SalesmanCollectionGroup,
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

function buildGroups(records: ExpectedCollectionRecord[], range: DateRange | null): SalesmanCollectionGroup[] {
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
        ? datesInRange(range).map((date) => {
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
  const [range, setRange] = useState<DateRange | null>(null);
  const [period, setPeriod] = useState<ReportPeriod>("weekly");
  const [referenceDate, setReferenceDate] = useState(currentManilaDateOnly);
  const [records, setRecords] = useState<ExpectedCollectionRecord[]>([]);
  const [filters, setFilters] = useState<ExpectedCollectionFilters>(EMPTY_FILTERS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

  const load = useCallback(async (
    requestedRange?: DateRange,
    resetFilters = true,
  ) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const requestId = ++requestIdRef.current;

    setLoading(true);
    setError(null);
    if (resetFilters) setFilters(EMPTY_FILTERS);

    const params = requestedRange
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

  const loadPeriod = useCallback((nextPeriod: ReportPeriod, nextReferenceDate: string, resetFilters = true) => {
    const nextRange = dateRangeForPeriod(nextPeriod, nextReferenceDate);
    if (nextRange) void load(nextRange, resetFilters);
  }, [load]);

  const selectPeriod = useCallback((nextPeriod: ReportPeriod) => {
    setPeriod(nextPeriod);
    loadPeriod(nextPeriod, referenceDate);
  }, [loadPeriod, referenceDate]);

  const selectReferenceDate = useCallback((nextReferenceDate: string) => {
    setReferenceDate(nextReferenceDate);
    loadPeriod(period, nextReferenceDate);
  }, [loadPeriod, period]);

  const navigatePeriod = useCallback((amount: number) => {
    const nextReferenceDate = shiftReferenceDate(referenceDate, period, amount);
    if (!nextReferenceDate) return;

    setReferenceDate(nextReferenceDate);
    loadPeriod(period, nextReferenceDate);
  }, [loadPeriod, period, referenceDate]);

  const previousPeriod = useCallback(() => navigatePeriod(-1), [navigatePeriod]);
  const nextPeriod = useCallback(() => navigatePeriod(1), [navigatePeriod]);

  const resetToCurrentPeriod = useCallback(() => {
    const nextReferenceDate = currentManilaDateOnly();
    setReferenceDate(nextReferenceDate);
    loadPeriod(period, nextReferenceDate, false);
  }, [loadPeriod, period]);

  return {
    range,
    period,
    referenceDate,
    records,
    filteredRecords,
    filters,
    setFilters,
    filterOptions,
    salesmanGroups,
    hasActiveFilters,
    loading,
    error,
    previousPeriod,
    nextPeriod,
    selectPeriod,
    selectStartDate: selectReferenceDate,
    selectEndDate: selectReferenceDate,
    resetToCurrentPeriod,
    clearFilters: () => setFilters(EMPTY_FILTERS),
  };
}
