"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AuditFilters, AuditFilterOptions, AuditHistoryPage } from "../report-types";
import { getAuditHistory } from "../providers/bankReconciliationReportsApi";

const empty: AuditFilters = { search: "", action: "", actorId: "", fromDate: "", toDate: "" };
type BadDates = { fromDate: boolean; toDate: boolean };
const validDate = (value: string) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value) && value >= "0001-01-01" && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
function dateError(filters: AuditFilters, bad: BadDates) {
  if (bad.fromDate || bad.toDate || !validDate(filters.fromDate) || !validDate(filters.toDate)) return "Enter valid From and To dates.";
  return filters.fromDate && filters.toDate && filters.fromDate > filters.toDate ? "From date must be on or before To date." : "";
}

/** Mounted per period; closure revisions keep the same full-period activity and boundary. */
export function useAuditHistory(periodId: number) {
  const [filters, setFilters] = useState<AuditFilters>(empty), [badDates, setBadDates] = useState<BadDates>({ fromDate: false, toDate: false });
  const [data, setData] = useState<AuditHistoryPage | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [options, setOptions] = useState<AuditFilterOptions>({ actions: [], actors: [] });
  const request = useRef<AbortController | null>(null), generation = useRef(0), timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const boundary = useRef<number | undefined>(undefined), target = useRef({ filters: empty, page: 1 });
  const cancel = useCallback(() => { ++generation.current; request.current?.abort(); clearTimeout(timer.current); }, []);
  const load = useCallback(async (query: AuditFilters, page: number) => {
    cancel(); const token = generation.current, controller = new AbortController(); request.current = controller;
    target.current = { filters: query, page }; setData(null); setLoading(true); setError("");
    try {
      const result = await getAuditHistory(periodId, page, boundary.current, controller.signal, query);
      if (token !== generation.current) return;
      boundary.current = result.throughEventId; setData(result);
      setOptions(result.filterOptions || { actions: [], actors: [] });
    } catch (e) { if (!controller.signal.aborted && token === generation.current) setError(e instanceof Error ? e.message : "Unable to load audit trail."); }
    finally { if (token === generation.current) setLoading(false); }
  }, [periodId, cancel]);
  useEffect(() => { void load(empty, 1); return cancel; }, [load, cancel]);
  const validation = dateError(filters, badDates);
  function change(next: AuditFilters, bad = badDates, delay = false) {
    cancel(); setFilters(next); setBadDates(bad); setData(null); setError(""); target.current = { filters: next, page: 1 };
    const invalid = dateError(next, bad); setLoading(!invalid);
    if (!invalid) { if (delay) timer.current = setTimeout(() => void load(next, 1), 300); else void load(next, 1); }
  }
  return {
    data, loading, error, filters, options, validation,
    active: Object.values(filters).some(value => value.trim()) || badDates.fromDate || badDates.toDate,
    change: (patch: Partial<AuditFilters>) => change({ ...filters, ...patch }, badDates, "search" in patch),
    changeDate: (field: "fromDate" | "toDate", value: string, badInput: boolean) => change({ ...filters, [field]: value }, { ...badDates, [field]: badInput }),
    clear: () => change(empty, { fromDate: false, toDate: false }),
    loadPage: (page: number) => { if (!validation) void load(filters, page); },
    retry: () => { if (!validation) void load(target.current.filters, target.current.page); },
    refresh: () => { if (!validation) { boundary.current = undefined; void load(filters, 1); } },
  };
}
