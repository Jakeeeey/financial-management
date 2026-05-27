// src/modules/financial-management/treasury/bank-management/bank-ledger/hooks/useBankLedger.ts
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { bankLedgerApi } from "../providers/bankLedgerApi";
import type {
  BankLedgerData,
  BankLedgerQuery,
} from "../types";

const emptyData: BankLedgerData = {
  banks: [],
  selectedBankId: null,
  entries: [],
  summary: {
    currentBalance: 0,
    totalDebits: 0,
    totalCredits: 0,
    entryCount: 0,
  },
  pagination: {
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 1,
  },
};

export function useBankLedger() {
  const [data, setData] = useState<BankLedgerData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadSeqRef = useRef(0);

  const loadLedger = useCallback(async (query?: BankLedgerQuery) => {
    const seq = ++loadSeqRef.current;

    try {
      setLoading(true);
      setError(null);
      const result = await bankLedgerApi.getLedger(query);
      if (seq !== loadSeqRef.current) return;
      setData(result);
    } catch (err) {
      if (seq !== loadSeqRef.current) return;
      const message =
        err instanceof Error ? err.message : "Failed to load bank ledger";
      setError(message);
      toast.error(message);
    } finally {
      if (seq === loadSeqRef.current) setLoading(false);
    }
  }, []);

  return {
    data,
    loading,
    error,
    loadLedger,
  };
}
