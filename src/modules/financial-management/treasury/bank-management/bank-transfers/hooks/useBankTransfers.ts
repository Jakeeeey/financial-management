// src/modules/financial-management/treasury/bank-management/bank-transfers/hooks/useBankTransfers.ts
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { bankTransfersApi } from "../providers/bankTransfersApi";
import type {
  BankTransferFormValues,
  BankTransferQuery,
  BankTransfersData,
  TransferStatus,
} from "../types";

const emptyData: BankTransfersData = {
  transfers: [],
  banks: [],
  paymentMethods: [],
  pagination: {
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 1,
    search: "",
    status: "ALL",
  },
};

export function useBankTransfers() {
  const [data, setData] = useState<BankTransfersData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadSeqRef = useRef(0);

  const loadTransfers = useCallback(async (query?: BankTransferQuery) => {
    const seq = ++loadSeqRef.current;

    try {
      setLoading(true);
      setError(null);
      const result = await bankTransfersApi.getTransfers(query);
      if (seq !== loadSeqRef.current) return;
      setData(result);
    } catch (err) {
      if (seq !== loadSeqRef.current) return;
      const message =
        err instanceof Error ? err.message : "Failed to load bank transfers";
      setError(message);
      toast.error(message);
    } finally {
      if (seq === loadSeqRef.current) setLoading(false);
    }
  }, []);

  const createTransfer = useCallback(async (payload: BankTransferFormValues) => {
    try {
      setSaving(true);
      await bankTransfersApi.createTransfer(payload);
      toast.success("Bank transfer prepared");
      return true;
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create bank transfer",
      );
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  const updateStatus = useCallback(
    async (transferId: number, status: TransferStatus) => {
      try {
        setSaving(true);
        await bankTransfersApi.updateStatus(transferId, status);
        toast.success(`Transfer marked as ${status.toLowerCase()}`);
        return true;
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to update transfer status",
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
    loadTransfers,
    createTransfer,
    updateStatus,
  };
}
