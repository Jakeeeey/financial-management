"use client";

import * as React from "react";
import type { PRListQuery, ProcurementRequest } from "../utils/types";
import { fetchPRList } from "../providers/approvalService";
import { toNumberSafe } from "../utils/parse";

type State = {
  rows: ProcurementRequest[];
  total: number;
  loading: boolean;
  error: string | null;
};

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();
}

function safeNum(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeQuery(query: PRListQuery): PRListQuery {
  const page = Math.max(1, Number(query.page ?? 1));
  const pageSize = Math.min(100, Math.max(5, Number(query.pageSize ?? 20)));
  return { ...query, page, pageSize };
}

function normalizeRow(r: Partial<ProcurementRequest>): ProcurementRequest {
  return {
    id: toNumberSafe(r.id) ?? 0,
    procurement_no: safeStr(r.procurement_no),
    supplier_id: toNumberSafe(r.supplier_id),
    lead_date: r.lead_date ?? null,
    total_amount: safeNum(r.total_amount),
    created_at: r.created_at ?? null,
    updated_at: r.updated_at ?? null,
    encoder_id: toNumberSafe(r.encoder_id),
    department_id: toNumberSafe(r.department_id),
    po_no: toNumberSafe(r.po_no),
    isApproved: r.isApproved != null ? Number(r.isApproved) : null,
    approved_by: toNumberSafe(r.approved_by),
    approved_date: r.approved_date ?? null,
    transaction_type: r.transaction_type ?? null,
    status: r.status ?? null,
    supplier_name: r.supplier_name ?? null,
    encoder_name: r.encoder_name ?? null,
    department_name: r.department_name ?? null,
  };
}

export function usePRList(query: PRListQuery) {
  const [state, setState] = React.useState<State>({ rows: [], total: 0, loading: true, error: null });
  const abortRef = React.useRef<AbortController | null>(null);

  const runFetch = React.useCallback(async () => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    const normalizedQuery = normalizeQuery(query);
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await fetchPRList(normalizedQuery, ac.signal);
      const total = safeNum(res?.meta?.filter_count ?? res?.meta?.total_count ?? 0) || 0;
      const rowsRaw: Partial<ProcurementRequest>[] = Array.isArray(res?.data) ? res.data : [];
      const rows = rowsRaw.map(normalizeRow);
      if (ac.signal.aborted) return;
      setState({ rows, total, loading: false, error: null });
    } catch (e: unknown) {
      if (ac.signal.aborted) return;
      setState((s) => ({ ...s, loading: false, error: e instanceof Error ? e.message : "Unknown error" }));
    }
  }, [query.q, query.status, query.supplier_id, query.date_from, query.date_to, query.page, query.pageSize]);

  React.useEffect(() => {
    void runFetch();
    return () => { abortRef.current?.abort(); };
  }, [runFetch]);

  return { ...state, reload: runFetch };
}
