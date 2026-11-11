"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { EMPTY_FILTERS, PAGE_SIZE } from "../constants";
import {
  ApiError,
  cancelBankMemo,
  createFundTransfer,
  createMemoTransaction,
  fetchTransactions,
  postTransactionEntry,
  settleFundTransfer,
} from "../providers/transactionsApi";
import type { MemoBody, TransferBody } from "../schemas";
import type { TransactionFilters, TransactionKind, TransactionRow, TransactionsPayload } from "../types";

function messageOf(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return "Something went wrong. Try again.";
}

/**
 * List state and mutations for the Cash & Bank Transactions lane.
 *
 * A mutation always refetches: the list mixes two tables and a transfer settle touches both the
 * row and the clearing panel, so patching one row in place would leave the other stale.
 */
export function useTransactions() {
  const [filters, setFilters] = useState<TransactionFilters>({ ...EMPTY_FILTERS });
  const [payload, setPayload] = useState<TransactionsPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Kept across loads so filtering to one kind never hides the others from the picker.
  const [knownKinds, setKnownKinds] = useState<TransactionKind[]>([]);

  const load = useCallback(async (next: TransactionFilters) => {
    setIsLoading(true);
    try {
      const data = await fetchTransactions(next);
      setPayload(data);
      setKnownKinds((current) => [...new Set([...current, ...data.kinds])]);
      setError(null);
    } catch (loadError) {
      setError(messageOf(loadError));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(filters);
  }, [filters, load]);

  const patchFilters = useCallback((patch: Partial<TransactionFilters>) => {
    setFilters((current) => {
      const page = patch.page ?? 1;
      return { ...current, ...patch, page };
    });
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({ ...EMPTY_FILTERS });
  }, []);

  const refetch = useCallback(() => load(filters), [filters, load]);

  /** Runs a write, toasts success and refetches. Rethrows so the caller can show the failure. */
  const runAction = useCallback(
    async <T,>(action: () => Promise<T>, successMessage: string): Promise<T> => {
      setIsSaving(true);
      try {
        const result = await action();
        toast.success(successMessage);
        await load(filters);
        return result;
      } finally {
        setIsSaving(false);
      }
    },
    [filters, load],
  );

  const createMemo = useCallback(
    (body: MemoBody) => runAction(() => createMemoTransaction(body), "Memo posted."),
    [runAction],
  );

  const createTransfer = useCallback(
    (body: TransferBody) => runAction(() => createFundTransfer(body), "Transfer posted."),
    [runAction],
  );

  const settle = useCallback(
    async (row: TransactionRow) => {
      try {
        await runAction(() => settleFundTransfer(row.id), "Transfer settled.");
      } catch (settleError) {
        toast.error(messageOf(settleError));
      }
    },
    [runAction],
  );

  /**
   * Settles every transfer whose value date has arrived, one at a time so one bad row cannot
   * stop the rest, and names the ones that failed instead of reporting a blanket success.
   */
  const settleMany = useCallback(
    async (due: TransactionRow[]) => {
      if (!due.length) return;
      setIsSaving(true);
      const failed: string[] = [];
      try {
        for (const row of due) {
          try {
            await settleFundTransfer(row.id);
          } catch {
            failed.push(row.refNo);
          }
        }
      } finally {
        setIsSaving(false);
        await load(filters);
      }
      const settled = due.length - failed.length;
      if (settled > 0) {
        toast.success(settled === 1 ? "1 transfer settled." : `${settled} transfers settled.`);
      }
      if (failed.length > 0) {
        toast.error(
          `${failed.length} of ${due.length} could not settle: ${failed.join(", ")}`,
        );
      }
    },
    [filters, load],
  );

  /**
   * Posts the entry a saved row is missing. The success toast carries the new journal number,
   * and the caller gets the result so an open dialog can show the link without waiting for the
   * list to reload.
   */
  const postEntry = useCallback(
    async (row: TransactionRow): Promise<{ jeNo: string } | null> => {
      setIsSaving(true);
      try {
        const result = await postTransactionEntry(row.kind, row.id);
        toast.success(`Entry posted · ${result.jeNo}`);
        await load(filters);
        return result;
      } catch (postError) {
        toast.error(messageOf(postError));
        return null;
      } finally {
        setIsSaving(false);
      }
    },
    [filters, load],
  );

  const cancelMemo = useCallback(
    async (memoId: number, reason: string) => {
      try {
        await runAction(() => cancelBankMemo(memoId, reason), "Memo cancelled and reversed.");
        return true;
      } catch (cancelError) {
        toast.error(messageOf(cancelError));
        return false;
      }
    },
    [runAction],
  );

  const pageCount = useMemo(() => {
    if (!payload) return 1;
    return Math.max(1, Math.ceil(payload.total / PAGE_SIZE));
  }, [payload]);

  return {
    filters,
    patchFilters,
    resetFilters,
    refetch,
    rows: payload?.rows ?? [],
    total: payload?.total ?? 0,
    page: payload?.page ?? filters.page,
    pageSize: payload?.pageSize ?? PAGE_SIZE,
    pageCount,
    accounts: payload?.accounts ?? [],
    expenseAccounts: payload?.expenseAccounts ?? [],
    clearing: payload?.clearing ?? [],
    mappingMissing: payload?.mappingMissing ?? [],
    knownKinds,
    notice: payload?.notice ?? null,
    isLoading,
    isSaving,
    error,
    createMemo,
    createTransfer,
    settle,
    settleMany,
    postEntry,
    cancelMemo,
  };
}
