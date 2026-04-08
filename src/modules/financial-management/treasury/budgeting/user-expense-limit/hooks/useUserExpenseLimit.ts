// src/modules/user-expense-limit/hooks/useUserExpenseLimit.ts

"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import type { UserExpenseLimit, User, CreateLimitPayload, UpdateLimitPayload, Department, LimitFilters } from "../types";
import { API_BASE } from "../utils";

function extractList<T>(json: unknown): T[] {
  if (Array.isArray(json)) return json as T[];
  if (typeof json === "object" && json !== null && "data" in json && Array.isArray((json as Record<string, unknown>).data)) {
    return (json as Record<string, unknown>).data as T[];
  }
  return [];
}

const DEFAULT_FILTERS: LimitFilters = {
  search:        "",
  department_id: "",
};

// ─── Main list hook with filters ──────────────────────────────────────────────
export function useUserExpenseLimits() {
  const [allLimits, setAllLimits] = useState<UserExpenseLimit[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [filters,   setFilters]   = useState<LimitFilters>(DEFAULT_FILTERS);

  // Only re-fetch from API when department_id changes — NOT on search
  const load = useCallback(async (departmentId: string) => {
    setLoading(true);
    setError(null);
    const toastId = toast.loading('Loading user expense limits...');
    try {
      const q   = new URLSearchParams();
      if (departmentId) q.set("department_id", departmentId);
      const url = departmentId ? `${API_BASE}?${q}` : API_BASE;
      const res = await fetch(url);
      const json: unknown = await res.json();
      if (!res.ok) {
        const obj = json as Record<string, unknown>;
        throw new Error(String(obj?.message ?? `HTTP ${res.status}`));
      }
      setAllLimits(extractList<UserExpenseLimit>(json));
      toast.success('User expense limits loaded successfully', { id: toastId });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setError(msg);
      toast.error(`Failed to load: ${msg}`, { id: toastId });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(filters.department_id);
  }, [filters.department_id]); // only re-fetch on department change

  // Apply search locally in memory — no loading, no fetch, instant
  const limits = useMemo(() => {
    const term = filters.search.trim().toLowerCase();
    if (!term) return allLimits;
    return allLimits.filter(l =>
      (l.user_name       ?? "").toLowerCase().includes(term) ||
      (l.user_email      ?? "").toLowerCase().includes(term) ||
      (l.user_department ?? "").toLowerCase().includes(term) ||
      l.expense_limit.toString().includes(term)
    );
  }, [allLimits, filters.search]);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    if (type === "success") toast.success(message);
    else toast.error(message);
  };

  const updateFilter = <K extends keyof LimitFilters>(key: K, value: LimitFilters[K]) =>
    setFilters(f => ({ ...f, [key]: value }));

  const clearFilters = () => setFilters(DEFAULT_FILTERS);
  const hasFilters   = Object.values(filters).some(Boolean);

  return {
    limits, loading, error, toast: null, showToast,
    refetch: () => load(filters.department_id),
    filters, updateFilter, clearFilters, hasFilters,
  };
}

// ─── Users without a limit (for Add dropdown) ────────────────────────────────
export function useUsersWithoutLimit() {
  const [users,   setUsers]   = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const r             = await fetch(`${API_BASE}?action=available-users`);
        const json: unknown = await r.json();
        if (!cancelled) {
          const list = Array.isArray(json)
            ? json as User[]
            : (json as Record<string, unknown>)?.data as User[] ?? [];
          setUsers(list);
        }
      } catch { /* silent */ } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, []);

  return { users, loading };
}

// ─── Create ───────────────────────────────────────────────────────────────────
export function useCreateLimit() {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const submit = async (payload: CreateLimitPayload) => {
    setLoading(true);
    setError(null);
    try {
      const res           = await fetch(API_BASE, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });
      const json: unknown = await res.json();
      const obj           = json as Record<string, unknown>;
      if (!res.ok) throw new Error(String(obj?.message ?? `HTTP ${res.status}`));
      return { success: true, message: String(obj.message ?? "Expense limit created.") };
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

// ─── Update ───────────────────────────────────────────────────────────────────
export function useUpdateLimit() {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const submit = async (id: number, payload: UpdateLimitPayload) => {
    setLoading(true);
    setError(null);
    try {
      const res           = await fetch(`${API_BASE}/${id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });
      const json: unknown = await res.json();
      const obj           = json as Record<string, unknown>;
      if (!res.ok) throw new Error(String(obj?.message ?? `HTTP ${res.status}`));
      return { success: true, message: String(obj.message ?? "Expense limit updated.") };
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

// ─── Fetch departments ────────────────────────────────────────────────────────
export function useDepartments() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading,     setLoading]     = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const r             = await fetch(`${API_BASE}?action=departments`);
        const json: unknown = await r.json();
        if (!cancelled) {
          const list = Array.isArray(json)
            ? json as Department[]
            : (json as Record<string, unknown>)?.data as Department[] ?? [];
          setDepartments(list);
        }
      } catch { /* silent */ } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, []);

  return { departments, loading };
}