// src/modules/financial-management/treasury/budgeting/user-expense-limit-approval/hooks/useUserExpenseLimitApproval.ts

"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import type { PendingLimitApproval } from "../../user-expense-limit/types";

const APPROVAL_API_BASE = "/api/fm/treasury/expense-approval/user-expense-limit/approval";

export function usePendingLimits() {
  const [pendingList, setPendingList] = useState<PendingLimitApproval[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const toastId = toast.loading('Loading pending ceiling requests...');
    try {
      const res = await fetch(APPROVAL_API_BASE);
      const json: unknown = await res.json();
      if (!res.ok) {
        const obj = json as Record<string, unknown>;
        throw new Error(String(obj?.message ?? `HTTP ${res.status}`));
      }
      const data = (json as { data?: PendingLimitApproval[] }).data ?? [];
      setPendingList(data);
      toast.success('Pending requests loaded successfully', { id: toastId });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setError(msg);
      toast.error(`Failed to load pending requests: ${msg}`, { id: toastId });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    if (type === "success") toast.success(message);
    else toast.error(message);
  };

  return {
    pendingList,
    loading,
    error,
    refetch: load,
    showToast
  };
}

export function useProcessLimitProposal() {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const processProposal = async (payload: {
    user_id: number;
    action:  "approve" | "reject";
    limits?: Record<number, number>;
    remarks?: string;
  }) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(APPROVAL_API_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const json: unknown = await res.json();
      const obj = json as Record<string, unknown>;
      if (!res.ok) throw new Error(String(obj?.message ?? `HTTP ${res.status}`));
      return { success: true, message: String(obj.message ?? `Limit request ${payload.action}d successfully.`) };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setError(msg);
      return { success: false };
    } finally {
      setLoading(false);
    }
  };

  return { processProposal, loading, error };
}
