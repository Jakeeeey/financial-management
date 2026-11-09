"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { PAGE_SIZE, fetchChangeLog } from "../providers/changeLogApi";
import { EMPTY_CHANGE_LOG_FILTER } from "../constants";
import type { ChangeLogFilter, ChangeLogRow } from "../types";

const EMPTY_ROWS: ChangeLogRow[] = [];

export function useChangeLog(year: number) {
  const [filters, setFiltersState] = useState<ChangeLogFilter>({ ...EMPTY_CHANGE_LOG_FILTER, year });
  const [rows, setRows] = useState<ChangeLogRow[]>(EMPTY_ROWS);
  const [total, setTotal] = useState(0);
  const [companies, setCompanies] = useState<Array<{ companyId: number; name: string; code: string }>>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const load = useCallback(async (next: ChangeLogFilter) => {
    const id = ++requestId.current;
    setIsLoading(true);
    setError(null);
    try {
      const payload = await fetchChangeLog(next);
      if (id !== requestId.current) return;
      setRows(payload.rows);
      setTotal(payload.total);
      setCompanies(payload.companies);
      setNotice(payload.notice);
    } catch (cause) {
      if (id !== requestId.current) return;
      setRows(EMPTY_ROWS);
      setTotal(0);
      setError(cause instanceof Error ? cause.message : "Could not read the change log.");
    } finally {
      if (id === requestId.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(filters);
  }, [filters, load]);

  const setFilters = useCallback((patch: Partial<ChangeLogFilter>) => {
    setFiltersState((current) => ({ ...current, ...patch, page: patch.page ?? 1 }));
  }, []);

  const setPage = useCallback((page: number) => {
    setFiltersState((current) => ({ ...current, page }));
  }, []);

  const refetch = useCallback(() => {
    void load(filters);
  }, [filters, load]);

  return {
    rows,
    total,
    companies,
    notice,
    error,
    isLoading,
    page: filters.page,
    pageSize: PAGE_SIZE,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    filters,
    setFilters,
    setPage,
    refetch,
  };
}
