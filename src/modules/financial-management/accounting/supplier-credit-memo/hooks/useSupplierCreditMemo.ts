// src/modules/financial-management/accounting/supplier-credit-memo/hooks/useSupplierCreditMemo.ts

"use client";

import { useState, useEffect, useCallback } from "react";
import type { SupplierCreditMemo, Supplier, ChartOfAccount, CreateMemoPayload, MemoFilters } from "../types";

const API_PATH = "/api/fm/accounting/supplier-credit-memo";

const DEFAULT_FILTERS: MemoFilters = {
  search:           "",
  supplier_id:      "",
  chart_of_account: "",
  status:           "",
};

function extractList<T>(json: unknown): T[] {
  if (Array.isArray(json)) return json as T[];
  if (typeof json === "object" && json !== null && "data" in json && Array.isArray((json as Record<string, unknown>).data)) {
    return (json as Record<string, unknown>).data as T[];
  }
  return [];
}

// ─── Main hook ────────────────────────────────────────────────────────────────
export function useSupplierCreditMemo() {
  const [memos,     setMemos]     = useState<SupplierCreditMemo[]>([]);
  const [total,     setTotal]     = useState(0);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [filters,   setFilters]   = useState<MemoFilters>(DEFAULT_FILTERS);
  const [toast,     setToast]     = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams();
      if (filters.search)           q.set("search",           filters.search);
      if (filters.supplier_id)      q.set("supplier_id",      filters.supplier_id);
      if (filters.chart_of_account) q.set("chart_of_account", filters.chart_of_account);
      if (filters.status)           q.set("status",           filters.status);

      const res  = await fetch(`${API_PATH}?${q}`);
      const json: unknown = await res.json();
      if (!res.ok) {
        const msg = typeof json === "object" && json !== null && "message" in json
          ? String((json as Record<string, unknown>).message)
          : `HTTP ${res.status}: ${res.statusText}`;
        throw new Error(msg);
      }
      const data = extractList<SupplierCreditMemo>(json);
      setMemos(data);
      const jsonObj = json as Record<string, unknown>;
      setTotal(typeof jsonObj.total === "number" ? jsonObj.total : data.length);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const updateFilter = <K extends keyof MemoFilters>(key: K, value: MemoFilters[K]) =>
    setFilters(f => ({ ...f, [key]: value }));

  const clearFilters = () => setFilters(DEFAULT_FILTERS);
  const hasFilters   = Object.values(filters).some(Boolean);

  const stats = {
    total,
    available:      memos.filter(m => m.status === "Available").length,
    pendingSOA:     memos.filter(m => m.status === "Pending SOA").length,
    totalAvailable: memos.filter(m => m.status === "Available").reduce((s, m) => s + parseFloat(m.amount), 0),
    totalAmount:    memos.reduce((s, m) => s + parseFloat(m.amount), 0),
  };

  return {
    memos, total, loading, error,
    filters, updateFilter, clearFilters, hasFilters,
    toast, showToast,
    modalOpen, setModalOpen,
    stats,
    refetch: load,
  };
}

// ─── Suppliers dropdown ───────────────────────────────────────────────────────
export function useSuppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading,   setLoading]   = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const r    = await fetch(`${API_PATH}?action=suppliers`);
        const json: unknown = await r.json();
        if (!cancelled) setSuppliers(extractList<Supplier>(json));
      } catch {
        // silent — dropdowns fail gracefully
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, []);

  return { suppliers, loading };
}

// ─── COA dropdown ─────────────────────────────────────────────────────────────
export function useChartOfAccounts() {
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [loading,  setLoading]  = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const r    = await fetch(`${API_PATH}?action=chart-of-accounts`);
        const json: unknown = await r.json();
        if (!cancelled) setAccounts(extractList<ChartOfAccount>(json));
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, []);

  return { accounts, loading };
}

// ─── Create memo ──────────────────────────────────────────────────────────────
export function useCreateMemo() {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const submit = async (payload: CreateMemoPayload) => {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch(API_PATH, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });
      const json: unknown = await res.json();
      const jsonObj = json as Record<string, unknown>;
      if (!res.ok) {
        throw new Error(
          String(jsonObj?.message || jsonObj?.error || (jsonObj?.errors as unknown[])?.[0] || `HTTP ${res.status}`)
        );
      }
      return {
        success: true,
        data:    jsonObj.data ?? json,
        message: typeof jsonObj.message === "string" ? jsonObj.message : "Memo created successfully.",
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setError(msg);
      return { success: false };
    } finally {
      setLoading(false);
    }
  };

  return { submit, loading, error };
}