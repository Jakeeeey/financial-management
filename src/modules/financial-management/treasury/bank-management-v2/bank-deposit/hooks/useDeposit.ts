"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import type { DepositSlip, SlipFilters, UndepositedAsset, UndepositedFilters } from "../types";
import { phtToday, toPhtDateString } from "../pht";
import { EMPTY_SLIP_FILTERS, EMPTY_UNDEPOSITED_FILTERS } from "../constants";
import { usePageSize } from "../components/TablePager";
import {
  cancelSlip as cancelSlipRequest,
  createSlip as createSlipRequest,
  fetchDepositSnapshot,
  type CreateSlipPayload,
  type CreateSlipResponse,
  type DepositAccountOption,
} from "../providers/depositApi";

const QUEUE_ROWS_KEY = "fm.bank-deposit.queue.rows";
const SLIPS_ROWS_KEY = "fm.bank-deposit.slips.rows";

/** A row can only be deposited once its collection is posted, dated and not voided. */
export function isDepositable(asset: UndepositedAsset): boolean {
  return asset.isPosted && !asset.isCancelled && Boolean(asset.collectionDate);
}

export type CreateSlipOutcome =
  | { ok: true; response: CreateSlipResponse }
  | { ok: false; message: string; fieldErrors: Record<string, string>; blockedDocuments: string[] };

/** State for the Bank Deposit screen: undeposited assets, slips and the two mutations. */
export function useDeposit() {
  const [assets, setAssets] = useState<UndepositedAsset[]>([]);
  const [slips, setSlips] = useState<DepositSlip[]>([]);
  const [accounts, setAccounts] = useState<DepositAccountOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Paging lives here so selection and the two tables survive a refetch; the tables
  // clamp a page that a shorter list leaves behind.
  const [assetsPage, setAssetsPage] = useState(1);
  const [slipsPage, setSlipsPage] = useState(1);
  const [assetsPageSize, persistAssetsPageSize] = usePageSize(QUEUE_ROWS_KEY);
  const [slipsPageSize, persistSlipsPageSize] = usePageSize(SLIPS_ROWS_KEY);
  const [filters, setFiltersState] = useState<UndepositedFilters>(EMPTY_UNDEPOSITED_FILTERS);
  const [slipFilters, setSlipFiltersState] = useState<SlipFilters>(EMPTY_SLIP_FILTERS);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const snapshot = await fetchDepositSnapshot();
      setAssets(snapshot.assets);
      setSlips(snapshot.slips);
      setAccounts(snapshot.accounts);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load deposits.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const setFilters = useCallback((next: UndepositedFilters) => {
    setFiltersState(next);
    setAssetsPage(1);
  }, []);

  const setAssetsPageSize = useCallback(
    (size: number) => {
      persistAssetsPageSize(size);
      setAssetsPage(1);
    },
    [persistAssetsPageSize],
  );

  const setSlipsPageSize = useCallback(
    (size: number) => {
      persistSlipsPageSize(size);
      setSlipsPage(1);
    },
    [persistSlipsPageSize],
  );

  const { filteredAssets, withheldAssets } = useMemo(() => {
    const today = phtToday();
    const query = filters.q.trim().toLowerCase();
    const matchesFilters = (asset: UndepositedAsset) => {
      if (filters.type !== "ALL" && asset.assetType !== filters.type) return false;
      const pdc = Boolean(asset.chequeDate && asset.chequeDate > today);
      if (filters.canDeposit === "READY" && pdc) return false;
      if (filters.canDeposit === "PDC" && !pdc) return false;
      const collected = toPhtDateString(asset.collectionDate);
      if (filters.from && collected < filters.from) return false;
      if (filters.to && collected > filters.to) return false;
      if (!query) return true;
      return [
        asset.documentNumber,
        asset.checkNo,
        asset.customer,
        asset.customerCode,
        asset.collectionReference,
        asset.bankName,
      ].some((value) => value && value.toLowerCase().includes(query));
    };
    const matching = assets.filter(matchesFilters);
    if (filters.scope === "ALL") return { filteredAssets: matching, withheldAssets: [] as UndepositedAsset[] };
    return {
      filteredAssets: matching.filter(isDepositable),
      withheldAssets: matching.filter((asset) => !isDepositable(asset)),
    };
  }, [assets, filters]);

  const setSlipFilters = useCallback((next: SlipFilters) => {
    setSlipFiltersState(next);
    setSlipsPage(1);
  }, []);

  const filteredSlips = useMemo(() => {
    const query = slipFilters.q.trim().toLowerCase();
    return slips.filter((slip) => {
      if (slipFilters.bank && slip.targetBankLabel !== slipFilters.bank) return false;
      if (slipFilters.status !== "ALL" && slip.status !== slipFilters.status) return false;
      const depositDate = toPhtDateString(slip.depositDate);
      if (slipFilters.from && depositDate < slipFilters.from) return false;
      if (slipFilters.to && depositDate > slipFilters.to) return false;
      if (!query) return true;
      return [slip.depositNo, slip.referenceNo, slip.remarks].some(
        (value) => value && value.toLowerCase().includes(query),
      );
    });
  }, [slips, slipFilters]);

  const totals = useMemo(() => {
    const today = phtToday();
    const month = today.slice(0, 7);
    const cash = assets.filter((asset) => asset.assetType === "CASH");
    const checks = assets.filter((asset) => asset.assetType === "CHECK");
    const isPdc = (asset: UndepositedAsset) => Boolean(asset.chequeDate && asset.chequeDate > today);
    const readyChecks = checks.filter((asset) => !isPdc(asset));
    const pdc = checks.filter(isPdc);
    const postedSlips = slips.filter((slip) => slip.status !== "CANCELLED" && slip.depositDate.startsWith(month));
    const sum = (rows: UndepositedAsset[]) => rows.reduce((total, asset) => total + asset.amount, 0);
    const cashTotal = sum(cash);
    return {
      undeposited: cashTotal + sum(checks),
      cash: cashTotal,
      checks: sum(checks),
      pendingSlips: slips.filter((slip) => slip.status !== "CLEARED" && slip.status !== "CANCELLED").length,
      overdueCash: cash.filter((asset) => asset.ageDays >= 1).length,
      cashCount: cash.length,
      oldestCashDate:
        cash
          .map((asset) => asset.collectionDate)
          .filter((date): date is string => Boolean(date))
          .sort()[0] ?? null,
      readyCheckTotal: sum(readyChecks),
      readyCheckCount: readyChecks.length,
      pdcTotal: sum(pdc),
      pdcCount: pdc.length,
      monthTotal: postedSlips.reduce((total, slip) => total + slip.totalCash + slip.totalChecks, 0),
      monthSlipCount: postedSlips.length,
    };
  }, [assets, slips]);

  const createSlip = useCallback(
    async (payload: CreateSlipPayload): Promise<CreateSlipOutcome> => {
      setIsSaving(true);
      try {
        const response = await createSlipRequest(payload);
        await refetch();
        if (response.postingBlocked) {
          toast.warning("Slip saved without a journal entry", {
            description: `Accounting still has to map ${response.postingBlocked.missingMappingKeys.join(", ")}.`,
          });
        } else {
          toast.success(`Deposit slip ${response.slip.depositNo} saved`);
        }
        if (response.notice) toast.info(response.notice);
        return { ok: true, response };
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "Could not save the slip.";
        const withFields = caught as Error & { fieldErrors?: Record<string, string> };
        const selectedIds = new Set([...payload.cashIds, ...payload.checkIds]);
        // Server messages now name the offending documents; match them back to rows to highlight.
        const blockedDocuments = assets
          .filter((asset) => selectedIds.has(asset.collectionDetailId) && message.includes(asset.documentNumber))
          .map((asset) => asset.documentNumber);
        toast.error(message);
        return { ok: false, message, fieldErrors: withFields.fieldErrors ?? {}, blockedDocuments };
      } finally {
        setIsSaving(false);
      }
    },
    [assets, refetch],
  );

  const cancelSlip = useCallback(
    async (slipId: number, reason: string) => {
      setIsSaving(true);
      try {
        await cancelSlipRequest(slipId, reason);
        await refetch();
        toast.success("Deposit slip cancelled");
        return true;
      } catch (caught) {
        toast.error(caught instanceof Error ? caught.message : "Could not cancel the slip.");
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [refetch],
  );

  return {
    assets,
    filteredAssets,
    withheldAssets,
    filters,
    setFilters,
    setAssetsPageSize,
    filteredSlips,
    slipFilters,
    setSlipFilters,
    setSlipsPageSize,
    slips,
    accounts,
    totals,
    isLoading,
    isSaving,
    error,
    refetch,
    createSlip,
    cancelSlip,
    assetsPage,
    setAssetsPage,
    assetsPageSize,
    slipsPage,
    setSlipsPage,
    slipsPageSize,
  };
}
