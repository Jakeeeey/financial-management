// src/modules/financial-management/treasury/bank-management/unified-bank-ledger/hooks/useUnifiedBankLedger.ts
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { unifiedBankLedgerApi } from "../providers/unifiedBankLedgerApi";
import type {
  UnifiedBankLedgerData,
  UnifiedBankLedgerQuery,
} from "../types";

const emptyData: UnifiedBankLedgerData = {
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

export function useUnifiedBankLedger() {
  const [data, setData] = useState<UnifiedBankLedgerData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadSeqRef = useRef(0);

  const loadLedger = useCallback(async (query?: UnifiedBankLedgerQuery) => {
    const seq = ++loadSeqRef.current;

    try {
      setLoading(true);
      setError(null);
      const result = await unifiedBankLedgerApi.getLedger(query);
      if (seq !== loadSeqRef.current) return;
      setData(result);
    } catch (err) {
      if (seq !== loadSeqRef.current) return;
      const message =
        err instanceof Error ? err.message : "Failed to load unified bank ledger";
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
