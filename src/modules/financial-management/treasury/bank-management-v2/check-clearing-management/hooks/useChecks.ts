"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { toast } from "sonner";

import type { BankCheck, CheckEvent, CheckStatus, CheckbookSeries } from "../types";
import {
  actOnCheck,
  clearChecks,
  createCheckbook,
  fetchCheckDetail,
  fetchRegister,
  issueCheck,
  listCheckbooks,
  receiveCheck,
  type CheckActionPayload,
  type CheckCounts,
  type IssueCheckPayload,
  type ReceiveCheckPayload,
  type RegisterFilters,
} from "../providers/checksApi";

const EMPTY_COUNTS: CheckCounts = {
  PENDING: 0,
  RECEIVED: 0,
  IN_CLEARING: 0,
  CLEARED: 0,
  RETURNED: 0,
  CANCELLED: 0,
};

/** State for the check register: filters, rows, per-status counts and every mutation. */
export function useChecks(initialFilters: RegisterFilters = {}) {
  const [filters, setFilters] = useState<RegisterFilters>({ direction: "ALL", status: "ALL", ...initialFilters });
  const [checks, setChecks] = useState<BankCheck[]>([]);
  const [counts, setCounts] = useState<CheckCounts>(EMPTY_COUNTS);
  const [accounts, setAccounts] = useState<{ bankId: number; label: string; bankName: string }[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  // A filter change re-scopes the register, so the old page number no longer means
  // anything; every caller already goes through this setter.
  const updateFilters = useCallback<Dispatch<SetStateAction<RegisterFilters>>>((next) => {
    setFilters(next);
    setPage(1);
  }, []);

  // Only the newest request may write state: a slow response for an older filter must not
  // repaint the list under a newer chip.
  const requestSeq = useRef(0);

  const refetch = useCallback(async () => {
    const seq = ++requestSeq.current;
    setIsLoading(true);
    setError(null);
    try {
      const register = await fetchRegister(filters);
      if (seq !== requestSeq.current) return;
      setChecks(register.checks);
      setCounts(register.counts ?? EMPTY_COUNTS);
      setAccounts(register.accounts ?? []);
      setNotice(register.notice ?? null);
    } catch (caught) {
      if (seq !== requestSeq.current) return;
      setError(caught instanceof Error ? caught.message : "Could not load the check register.");
    } finally {
      if (seq === requestSeq.current) setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const statusTiles = useMemo(
    () =>
      (Object.keys(EMPTY_COUNTS) as CheckStatus[]).map((status) => ({
        status,
        count: counts[status] ?? 0,
      })),
    [counts],
  );

  const run = useCallback(
    async <T,>(action: () => Promise<T>, successMessage: string): Promise<T | null> => {
      setIsSaving(true);
      try {
        const result = await action();
        // The register reload costs more than the write itself, so it runs behind the
        // dialog: the button stops spinning when the action lands, not when the list repaints.
        void refetch();
        toast.success(successMessage);
        return result;
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "The action failed.";
        toast.error(message);
        return null;
      } finally {
        setIsSaving(false);
      }
    },
    [refetch],
  );

  const issue = useCallback(
    (payload: IssueCheckPayload) => run(() => issueCheck(payload), "Check issued"),
    [run],
  );

  const receive = useCallback(
    (payload: ReceiveCheckPayload) => run(() => receiveCheck(payload), "Check recorded"),
    [run],
  );

  const act = useCallback(
    (check: BankCheck, payload: CheckActionPayload) =>
      run(() => actOnCheck(check.id, payload), `${payload.action.charAt(0)}${payload.action.slice(1).toLowerCase()} recorded`),
    [run],
  );

  const bulkClear = useCallback(
    async (entries: { checkId: number; clearedDate: string }[]) => {
      setIsSaving(true);
      try {
        const result = await clearChecks(entries);
        await refetch();
        if (result.failures.length) {
          toast.error(`${result.failures.length} check(s) could not be cleared: ${result.failures[0].message}`);
        } else {
          toast.success(`${result.cleared.length} check(s) cleared`);
        }
        if (result.blocked.length) {
          toast.warning("Cleared, but the journal entry is blocked until the GL mapping is set.");
        }
        return result;
      } catch (caught) {
        toast.error(caught instanceof Error ? caught.message : "The checks could not be cleared.");
        return null;
      } finally {
        setIsSaving(false);
      }
    },
    [refetch],
  );

  const addSeries = useCallback(
    (payload: { bankAccountId: number; seriesStart: string; seriesEnd: string }) =>
      run(() => createCheckbook(payload), "Checkbook series added"),
    [run],
  );

  const loadSeries = useCallback(async (): Promise<{ series: CheckbookSeries[]; notice?: string } | null> => {
    try {
      return await listCheckbooks();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not load the checkbook series.");
      return null;
    }
  }, []);

  const loadDetail = useCallback(    async (checkId: number): Promise<{ check: BankCheck; events: CheckEvent[] } | null> => {
      try {
        return await fetchCheckDetail(checkId);
      } catch (caught) {
        toast.error(caught instanceof Error ? caught.message : "Could not load the check.");
        return null;
      }
    },
    [],
  );

  return {
    checks,
    counts,
    statusTiles,
    accounts,
    notice,
    filters,
    setFilters: updateFilters,
    page,
    setPage,
    isLoading,
    isSaving,
    error,
    refetch,
    issue,
    receive,
    act,
    bulkClear,
    addSeries,
    loadSeries,
    loadDetail,
  };
}
