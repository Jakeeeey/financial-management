"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  currentManilaDateOnly,
  dateRangeForPeriod,
  datesInRange,
  formatDateOnly,
  parseDateOnly,
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

function buildChartPoints(
  records: ExpectedCollectionRecord[],
  range: DateRange | null,
  period: ReportPeriod,
) {
  if (!range) return [];

  const start = parseDateOnly(range.startDate);
  const end = parseDateOnly(range.endDate);
  if (!start || !end) return [];

  const rangeDays = Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  const amountByDate = new Map<string, number>();
  records.forEach((record) => {
    amountByDate.set(record.dueDate, (amountByDate.get(record.dueDate) || 0) + record.outstandingBalance);
  });

  if (period === "yearly" || rangeDays > 62) {
    const amountByMonth = new Map<string, number>();
    records.forEach((record) => {
      const key = record.dueDate.slice(0, 7);
      amountByMonth.set(key, (amountByMonth.get(key) || 0) + record.outstandingBalance);
    });

    const points = [];
    for (
      let cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
      cursor.getTime() <= end.getTime();
      cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1))
    ) {
      const date = formatDateOnly(cursor);
      const key = date.slice(0, 7);
      points.push({
        date,
        label: new Intl.DateTimeFormat("en-US", {
          timeZone: "UTC",
          month: "short",
          year: start.getUTCFullYear() === end.getUTCFullYear() ? undefined : "2-digit",
        }).format(cursor),
        amount: amountByMonth.get(key) || 0,
      });
    }
    return points;
  }

  const dates = datesInRange(range);
  if (period === "monthly" || rangeDays > 14) {
    const points = [];
    for (let index = 0; index < dates.length; index += 7) {
      const bucket = dates.slice(index, index + 7);
      const first = bucket[0];
      const last = bucket[bucket.length - 1];
      points.push({
        date: first,
        label: `${first.slice(5)}–${last.slice(5)}`,
        amount: bucket.reduce((sum, date) => sum + (amountByDate.get(date) || 0), 0),
      });
    }
    return points;
  }

  return dates.map((date) => ({
    date,
    label: weekdayLabel(date),
    amount: amountByDate.get(date) || 0,
  }));
}

function buildGroups(
  records: ExpectedCollectionRecord[],
  range: DateRange | null,
  period: ReportPeriod,
): SalesmanCollectionGroup[] {
  const grouped = new Map<string, ExpectedCollectionRecord[]>();

  records.forEach((record) => {
    const name = displayName(record.salesman, "Unassigned Salesman");
    const existing = grouped.get(name) || [];
    existing.push(record);
    grouped.set(name, existing);
  });

  return Array.from(grouped.entries())
    .map(([name, groupRecords]) => {
      const dailyOutstanding = buildChartPoints(groupRecords, range, period);

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

interface ReportSelection {
  period: ReportPeriod;
  referenceDate: string;
}

export function useExpectedCollectionReport() {
  const [range, setRange] = useState<DateRange | null>(null);
  const [period, setPeriod] = useState<ReportPeriod>("weekly");
  const [referenceDate, setReferenceDate] = useState(currentManilaDateOnly);
  const [records, setRecords] = useState<ExpectedCollectionRecord[]>([]);
  const [filters, setFilters] = useState<ExpectedCollectionFilters>(EMPTY_FILTERS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resultVersion, setResultVersion] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const lastRequestRef = useRef<{ range?: DateRange; selection?: ReportSelection }>({});

  const load = useCallback(async (
    requestedRange?: DateRange,
    selection?: ReportSelection,
  ) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const requestId = ++requestIdRef.current;
    lastRequestRef.current = { range: requestedRange, selection };

    setLoading(true);
    setError(null);

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
      setResultVersion((current) => current + 1);
      if (selection) {
        setPeriod(selection.period);
        setReferenceDate(selection.referenceDate);
      }
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
    () => buildGroups(filteredRecords, range, period),
    [filteredRecords, period, range],
  );

  const hasActiveFilters = Boolean(
    filters.division || filters.salesman || filters.customerName.trim() || filters.invoiceNo.trim(),
  );

  const loadPeriod = useCallback((nextPeriod: ReportPeriod, nextReferenceDate: string) => {
    const nextRange = dateRangeForPeriod(nextPeriod, nextReferenceDate);
    if (nextRange) {
      void load(nextRange, { period: nextPeriod, referenceDate: nextReferenceDate });
    }
  }, [load]);

  const selectPeriod = useCallback((nextPeriod: ReportPeriod) => {
    if (nextPeriod === "custom") {
      setPeriod("custom");
      return;
    }
    loadPeriod(nextPeriod, referenceDate);
  }, [loadPeriod, referenceDate]);

  const applyCustomRange = useCallback((nextRange: DateRange) => {
    const start = parseDateOnly(nextRange.startDate);
    const end = parseDateOnly(nextRange.endDate);
    if (!start || !end || start.getTime() > end.getTime()) return;

    void load(nextRange, { period: "custom", referenceDate: nextRange.startDate });
  }, [load]);

  const navigatePeriod = useCallback((amount: number) => {
    if (period === "custom") return;
    const nextReferenceDate = shiftReferenceDate(referenceDate, period, amount);
    if (!nextReferenceDate) return;

    loadPeriod(period, nextReferenceDate);
  }, [loadPeriod, period, referenceDate]);

  const previousPeriod = useCallback(() => navigatePeriod(-1), [navigatePeriod]);
  const nextPeriod = useCallback(() => navigatePeriod(1), [navigatePeriod]);

  const resetToCurrentPeriod = useCallback(() => {
    if (period === "custom") return;
    const nextReferenceDate = currentManilaDateOnly();
    loadPeriod(period, nextReferenceDate);
  }, [loadPeriod, period]);

  const retry = useCallback(() => {
    const lastRequest = lastRequestRef.current;
    void load(lastRequest.range, lastRequest.selection);
  }, [load]);

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
    resultVersion,
    hasActiveFilters,
    loading,
    initialLoading: loading && range === null,
    refreshing: loading && range !== null,
    error,
    retry,
    previousPeriod,
    nextPeriod,
    selectPeriod,
    applyCustomRange,
    resetToCurrentPeriod,
    clearFilters: () => setFilters(EMPTY_FILTERS),
  };
}
