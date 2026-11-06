"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import type { DepositSlip, UndepositedAsset } from "../types";
import {
  cancelSlip as cancelSlipRequest,
  createSlip as createSlipRequest,
  fetchDepositSnapshot,
  type CreateSlipPayload,
  type CreateSlipResponse,
  type DepositAccountOption,
} from "../providers/depositApi";

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

  const totals = useMemo(() => {
    const cash = assets.filter((asset) => asset.assetType === "CASH");
    const checks = assets.filter((asset) => asset.assetType === "CHECK");
    return {
      undeposited: cash.reduce((sum, asset) => sum + asset.amount, 0) + checks.reduce((sum, asset) => sum + asset.amount, 0),
      cash: cash.reduce((sum, asset) => sum + asset.amount, 0),
      checks: checks.reduce((sum, asset) => sum + asset.amount, 0),
      pendingSlips: slips.filter((slip) => slip.status !== "CLEARED" && slip.status !== "CANCELLED").length,
      overdueCash: cash.filter((asset) => asset.ageDays >= 1).length,
    };
  }, [assets, slips]);

  const createSlip = useCallback(
    async (payload: CreateSlipPayload): Promise<CreateSlipResponse | null> => {
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
        return response;
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "Could not save the slip.";
        toast.error(message);
        return null;
      } finally {
        setIsSaving(false);
      }
    },
    [refetch],
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
    slipsPage,
    setSlipsPage,
  };
}
