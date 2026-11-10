"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { fetchCalendar, type CalendarPayload } from "../providers/calendarApi";
import type { CalendarDayItem, CalendarFilter, CalendarObligation } from "../types";

export const CALENDAR_PAGE_SIZE = 20;

const EMPTY: CalendarFilter = { companyId: null, category: "ALL", status: "ALL", from: "", to: "" };

export function useTaxCalendar(year: number) {
  const [filters, setFiltersState] = useState<CalendarFilter>(EMPTY);
  const [payload, setPayload] = useState<CalendarPayload | null>(null);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** The year the payload on screen was built for, so a switch never shows the old year's figures. */
  const [settledYear, setSettledYear] = useState<number | null>(null);
  const requestId = useRef(0);
  const wantFresh = useRef(false);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setIsLoading(true);
    setError(null);
    try {
      const fresh = wantFresh.current;
      wantFresh.current = false;
      const next = await fetchCalendar(filters.companyId, year, fresh);
      if (id !== requestId.current) return;
      setPayload(next);
      setSettledYear(year);
    } catch (cause) {
      if (id !== requestId.current) return;
      setPayload(null);
      setError(cause instanceof Error ? cause.message : "Could not build the tax calendar.");
    } finally {
      if (id === requestId.current) setIsLoading(false);
    }
  }, [filters.companyId, year]);

  useEffect(() => {
    void load();
  }, [load]);

  const setFilters = useCallback((patch: Partial<CalendarFilter>) => {
    setFiltersState((current) => ({ ...current, ...patch }));
    setPage(1);
  }, []);

  const rows: CalendarObligation[] = useMemo(() => {
    const all = payload?.obligations ?? [];
    return all.filter((row) => {
      if (filters.category !== "ALL" && row.category !== filters.category) return false;
      if (filters.status !== "ALL" && row.status !== filters.status) return false;
      if (filters.from && row.dueDate < filters.from) return false;
      if (filters.to && row.dueDate > filters.to) return false;
      return true;
    });
  }, [payload, filters]);

  const pageCount = Math.max(1, Math.ceil(rows.length / CALENDAR_PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = rows.slice((safePage - 1) * CALENDAR_PAGE_SIZE, safePage * CALENDAR_PAGE_SIZE);

  /** Every filing of the year, shaped for the month grid. Deliberately unfiltered: the
   *  filter controls live on the Deadlines tab only. */
  const events: CalendarDayItem[] = useMemo(
    () =>
      (payload?.obligations ?? []).map((row) => ({
        date: row.dueDate,
        formCode: row.formCode,
        companyName: row.companyName,
        period: row.periodLabel,
        amount: row.estimated,
        status: row.status,
      })),
    [payload],
  );

  const counts = useMemo(() => {
    const all = payload?.obligations ?? [];
    return {
      total: all.length,
      overdue: all.filter((row) => row.status === "OVERDUE").length,
      due: all.filter((row) => row.status === "DUE").length,
      paid: all.filter((row) => row.status === "PAID").length,
      estimated: all.reduce((sum, row) => sum + (row.status === "PAID" ? 0 : (row.estimated ?? 0)), 0),
    };
  }, [payload]);

  return {
    rows: pageRows,
    total: rows.length,
    counts,
    events,
    companies: payload?.companies ?? [],
    notices: payload?.notices ?? [],
    today: payload?.today ?? "",
    page: safePage,
    pageCount,
    pageSize: CALENDAR_PAGE_SIZE,
    filters,
    setFilters,
    settledYear,
    setPage,
    isLoading,
    error,
    refetch: useCallback(() => {
      wantFresh.current = true;
      void load();
    }, [load]),
  };
}


