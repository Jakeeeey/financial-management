// src/modules/financial-management/treasury/bank-management/account-management/hooks/useAccountManagement.ts
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AccountManagementApiError,
  accountManagementApi,
} from "../providers/accountManagementApi";
import type {
  AccountManagementData,
  AccountManagementFormValues,
  AccountManagementQuery,
  AccountManagementSaveResult,
} from "../types";

const emptyData: AccountManagementData = {
  accounts: [],
  bankNames: [],
  accountTypes: [],
  pagination: {
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 1,
    search: "",
    status: "all",
    bankName: "",
    accountType: "",
    accountName: "",
    createdFrom: "",
    createdTo: "",
  },
};

export function useAccountManagement() {
  const [data, setData] = useState<AccountManagementData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadSeqRef = useRef(0);

  const loadAccounts = useCallback(
    async (query?: AccountManagementQuery) => {
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
    async (
      payload: AccountManagementFormValues,
    ): Promise<AccountManagementSaveResult> => {
      try {
        setSaving(true);
        await accountManagementApi.createAccount(payload);
        toast.success("Bank account created");
        return { ok: true };
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to create bank account";
        toast.error(message);
        return {
          ok: false,
          message,
          fieldErrors:
            err instanceof AccountManagementApiError
              ? err.fieldErrors
              : undefined,
        };
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
    ): Promise<AccountManagementSaveResult> => {
      try {
        setSaving(true);
        await accountManagementApi.updateAccount(bankId, payload);
        toast.success("Bank account updated");
        return { ok: true };
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to update bank account";
        toast.error(message);
        return {
          ok: false,
          message,
          fieldErrors:
            err instanceof AccountManagementApiError
              ? err.fieldErrors
              : undefined,
        };
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
