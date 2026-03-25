// src/modules/financial-management/accounting/supplier-credit-memo/hooks/useSupplierCreditMemo.ts

"use client";

import { useState, useEffect, useCallback } from "react";
import type { SupplierMemo, Supplier, ChartOfAccount, CreateMemoPayload, MemoFilters } from "../types";

const API_PATH = "/api/fm/accounting/supplier-credit-memo";

const DEFAULT_FILTERS: MemoFilters = {
  search:           "",
  supplier_id:      "",
  chart_of_account: "",
  status:           "",
};

function extractList<T>(json: any): T[] {
  if (Array.isArray(json))       return json as T[];
  if (Array.isArray(json?.data)) return json.data as T[];
  return [];
}

// ─── Main hook ────────────────────────────────────────────────────────────────
export function useSupplierCreditMemo() {
  const [memos,     setMemos]     = useState<SupplierMemo[]>([]);
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
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || `HTTP ${res.status}: ${res.statusText}`);
      const data = extractList<SupplierMemo>(json);
      setMemos(data);
      setTotal(json?.total ?? data.length);
    } catch (e: any) {
      setError(e.message);
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
    setLoading(true);
    fetch(`${API_PATH}?action=suppliers`)
      .then(r => r.json())
      .then(json => setSuppliers(extractList<Supplier>(json)))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return { suppliers, loading };
}

// ─── COA dropdown ─────────────────────────────────────────────────────────────
export function useChartOfAccounts() {
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [loading,  setLoading]  = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`${API_PATH}?action=chart-of-accounts`)
      .then(r => r.json())
      .then(json => setAccounts(extractList<ChartOfAccount>(json)))
      .catch(console.error)
      .finally(() => setLoading(false));
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
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || json?.error || `HTTP ${res.status}`);
      return { success: true, data: json.data ?? json, message: json.message ?? "Memo created successfully." };
    } catch (e: any) {
      setError(e.message);
      return { success: false };
    } finally {
      setLoading(false);
    }
  };

  return { submit, loading, error };
}