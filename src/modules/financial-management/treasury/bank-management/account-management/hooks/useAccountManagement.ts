// src/modules/financial-management/treasury/bank-management/account-management/hooks/useAccountManagement.ts
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { accountManagementApi } from "../providers/accountManagementApi";
import type {
  AccountManagementData,
  AccountManagementFormValues,
  AccountStatusFilter,
} from "../types";

const emptyData: AccountManagementData = {
  accounts: [],
  bankNames: [],
  pagination: {
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 1,
    search: "",
    status: "all",
  },
};

export function useAccountManagement() {
  const [data, setData] = useState<AccountManagementData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadSeqRef = useRef(0);

  const loadAccounts = useCallback(
    async (query?: {
      page?: number;
      pageSize?: number;
      search?: string;
      status?: AccountStatusFilter;
    }) => {
      const seq = ++loadSeqRef.current;

      try {
        setLoading(true);
        setError(null);
        const result = await accountManagementApi.getAccounts(query);
        if (seq !== loadSeqRef.current) return;
        setData(result);
      } catch (err) {
        if (seq !== loadSeqRef.current) return;
        const message =
          err instanceof Error ? err.message : "Failed to load bank accounts";
        setError(message);
        toast.error(message);
      } finally {
        if (seq === loadSeqRef.current) setLoading(false);
      }
    },
    [],
  );

  const createAccount = useCallback(
    async (payload: AccountManagementFormValues) => {
      try {
        setSaving(true);
        await accountManagementApi.createAccount(payload);
        toast.success("Bank account created");
        return true;
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to create bank account",
        );
        return false;
      } finally {
        setSaving(false);
      }
    },
    [],
  );

  const updateAccount = useCallback(
    async (
      bankId: number,
      payload: Partial<AccountManagementFormValues> & { isActive?: boolean },
    ) => {
      try {
        setSaving(true);
        await accountManagementApi.updateAccount(bankId, payload);
        toast.success("Bank account updated");
        return true;
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to update bank account",
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
    loadAccounts,
    createAccount,
    updateAccount,
  };
}
