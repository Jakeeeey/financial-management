// src/modules/user-expense-limit/hooks/useUserExpenseLimit.ts

"use client";

import { useState, useEffect, useCallback } from "react";
import type { UserExpenseLimit, User, CreateLimitPayload, UpdateLimitPayload } from "../types";
import { API_BASE } from "../utils";

function extractList<T>(json: unknown): T[] {
  if (Array.isArray(json)) return json as T[];
  if (typeof json === "object" && json !== null && "data" in json && Array.isArray((json as Record<string, unknown>).data)) {
    return (json as Record<string, unknown>).data as T[];
  }
  return [];
}

// ─── Main list hook ───────────────────────────────────────────────────────────
export function useUserExpenseLimits() {
  const [limits,  setLimits]  = useState<UserExpenseLimit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [toast,   setToast]   = useState<{ message: string; type: "success" | "error" } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res         = await fetch(API_BASE);
      const json: unknown = await res.json();
      if (!res.ok) {
        const obj = json as Record<string, unknown>;
        throw new Error(String(obj?.message ?? `HTTP ${res.status}`));
      }
      setLimits(extractList<UserExpenseLimit>(json));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  return { limits, loading, error, toast, showToast, refetch: load };
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
        const r           = await fetch(`${API_BASE}?action=available-users`);
        const json: unknown = await r.json();
        if (!cancelled) {
          // Response has user_id, user_fname, user_lname, user_email
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
      const res         = await fetch(API_BASE, {
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
      const res         = await fetch(`${API_BASE}/${id}`, {
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