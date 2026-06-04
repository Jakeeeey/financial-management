// src/modules/financial-management/treasury/bank-management/bank-reconciliation/hooks/useBankReconciliation.ts
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { bankReconciliationApi } from "../providers/bankReconciliationApi";
import type {
  BankReconciliationData,
  BankReconciliationFormValues,
  BankReconciliationQuery,
  BankReconciliationSystemBalancePreview,
  ReconciliationStatus,
} from "../types";

const emptyData: BankReconciliationData = {
  reconciliations: [],
  banks: [],
  pagination: {
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 1,
    search: "",
    status: "ALL",
  },
};

export function useBankReconciliation() {
  const [data, setData] = useState<BankReconciliationData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [systemBalancePreview, setSystemBalancePreview] =
    useState<BankReconciliationSystemBalancePreview | null>(null);
  const [systemBalanceLoading, setSystemBalanceLoading] = useState(false);
  const [systemBalanceError, setSystemBalanceError] = useState<string | null>(
    null,
  );
  const loadSeqRef = useRef(0);
  const systemBalanceSeqRef = useRef(0);

  const loadReconciliations = useCallback(
    async (query?: BankReconciliationQuery) => {
      const seq = ++loadSeqRef.current;

      try {
        setLoading(true);
        setError(null);
        const result = await bankReconciliationApi.getReconciliations(query);
        if (seq !== loadSeqRef.current) return;
        setData(result);
      } catch (err) {
        if (seq !== loadSeqRef.current) return;
        const message =
          err instanceof Error
            ? err.message
            : "Failed to load bank reconciliations";
        setError(message);
        toast.error(message);
      } finally {
        if (seq === loadSeqRef.current) setLoading(false);
      }
    },
    [],
  );

  const createReconciliation = useCallback(
    async (payload: BankReconciliationFormValues) => {
      try {
        setSaving(true);
        await bankReconciliationApi.createReconciliation(payload);
        toast.success("Bank reconciliation drafted");
        return true;
      } catch (err) {
        toast.error(
          err instanceof Error
            ? err.message
            : "Failed to create bank reconciliation",
        );
        return false;
      } finally {
        setSaving(false);
      }
    },
    [],
  );

  const loadSystemBalancePreview = useCallback(
    async (bankId: number, statementDate: string) => {
      const seq = ++systemBalanceSeqRef.current;

      try {
        setSystemBalanceLoading(true);
        setSystemBalanceError(null);
        const result = await bankReconciliationApi.getSystemBalancePreview(
          bankId,
          statementDate,
        );
        if (seq !== systemBalanceSeqRef.current) return;
        setSystemBalancePreview(result);
      } catch (err) {
        if (seq !== systemBalanceSeqRef.current) return;
        setSystemBalancePreview(null);
        setSystemBalanceError(
          err instanceof Error
            ? err.message
            : "Failed to calculate system balance",
        );
      } finally {
        if (seq === systemBalanceSeqRef.current) setSystemBalanceLoading(false);
      }
    },
    [],
  );

  const resetSystemBalancePreview = useCallback(() => {
    systemBalanceSeqRef.current += 1;
    setSystemBalancePreview(null);
    setSystemBalanceError(null);
    setSystemBalanceLoading(false);
  }, []);

  const updateStatus = useCallback(
    async (reconciliationId: number, status: ReconciliationStatus) => {
      try {
        setSaving(true);
        await bankReconciliationApi.updateStatus(reconciliationId, status);
        toast.success(`Reconciliation marked as ${status.toLowerCase()}`);
        return true;
      } catch (err) {
        toast.error(
          err instanceof Error
            ? err.message
            : "Failed to update reconciliation status",
        );
        return false;
      } finally {
        setSaving(false);
      }
    },
    [],
  );

  return {
    data,
    loading,
    saving,
    error,
    systemBalancePreview,
    systemBalanceLoading,
    systemBalanceError,
    loadReconciliations,
    createReconciliation,
    loadSystemBalancePreview,
    resetSystemBalancePreview,
    updateStatus,
  };
}
