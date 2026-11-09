"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  DormancyApiError,
  escheatAccount,
  fetchDormancy,
  fetchPreClosure,
  lockAccountClosure,
  reclassifyAccount,
  settleClosure,
} from "../providers/dormancyApi";
import type { DormancyAccount, DormancyFilter, PreClosureResult } from "../types";
import { EMPTY_FILTERS, PAGE_SIZE } from "../constants";

function matches(account: DormancyAccount, filter: DormancyFilter): boolean {
  if (filter.bankName && account.bankName !== filter.bankName) return false;
  if (filter.classification !== "ALL" && account.classification !== filter.classification) return false;
  if (filter.status !== "ALL" && account.status !== filter.status) return false;
  const needle = filter.q.trim().toLowerCase();
  if (!needle) return true;
  return (
    account.bankName.toLowerCase().includes(needle) ||
    account.accountNumber.toLowerCase().includes(needle) ||
    (account.accountName ?? "").toLowerCase().includes(needle) ||
    (account.branch ?? "").toLowerCase().includes(needle)
  );
}

export function useDormancy() {
  const [accounts, setAccounts] = useState<DormancyAccount[]>([]);
  const [notice, setNotice] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFiltersState] = useState<DormancyFilter>({ ...EMPTY_FILTERS });
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const snapshot = await fetchDormancy();
      setAccounts(snapshot.accounts);
      setNotice(snapshot.notice);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The dormancy scan could not be loaded.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const setFilters = useCallback((next: DormancyFilter) => {
    setFiltersState(next);
    setPage(1);
  }, []);

  const filteredAccounts = useMemo(
    () => accounts.filter((account) => matches(account, filters)),
    [accounts, filters],
  );

  const pageCount = Math.max(1, Math.ceil(filteredAccounts.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const visibleAccounts = filteredAccounts.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const counts = useMemo(() => {
    const tally = { ACTIVE: 0, INACTIVE: 0, DORMANT_ELIGIBLE: 0, DORMANT: 0, ESCHEAT_ELIGIBLE: 0 };
    for (const account of accounts) tally[account.classification] += 1;
    return tally;
  }, [accounts]);

  const run = useCallback(
    async (action: () => Promise<string>, successFallback: string) => {
      setIsSaving(true);
      try {
        const message = await action();
        toast.success(message || successFallback);
        await load();
        return true;
      } catch (caught) {
        if (caught instanceof DormancyApiError && caught.missingMappingKeys.length > 0) {
          toast.warning("GL mapping is incomplete, so nothing was posted.", {
            description: `Configure: ${caught.missingMappingKeys.join(", ")}`,
          });
        } else {
          toast.error(caught instanceof Error ? caught.message : successFallback);
        }
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [load],
  );

  const reclassify = useCallback(
    (bankId: number) => run(async () => (await reclassifyAccount(bankId)).message, "Account reclassified."),
    [run],
  );

  const escheat = useCallback(
    (bankId: number) => run(async () => (await escheatAccount(bankId)).message, "Balance escheated."),
    [run],
  );

  const settle = useCallback(
    (bankId: number, accruedInterest: number, cutOff: string) =>
      run(async () => (await settleClosure(bankId, { accruedInterest, cutOff })).message, "Settlement posted."),
    [run],
  );

  const lock = useCallback(
    (bankId: number, reason: string) =>
      run(async () => (await lockAccountClosure(bankId, reason)).message, "Account closed."),
    [run],
  );

  const loadPreClosure = useCallback(async (bankId: number): Promise<PreClosureResult | null> => {
    try {
      return await fetchPreClosure(bankId);
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "The closure checklist could not be loaded.");
      return null;
    }
  }, []);

  return {
    accounts,
    visibleAccounts,
    filteredCount: filteredAccounts.length,
    counts,
    notice,
    error,
    isLoading,
    isSaving,
    filters,
    setFilters,
    page: safePage,
    pageCount,
    setPage,
    refetch: load,
    reclassify,
    escheat,
    settle,
    lock,
    loadPreClosure,
  };
}
