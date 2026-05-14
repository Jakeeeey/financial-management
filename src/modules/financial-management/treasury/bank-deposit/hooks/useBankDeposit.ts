"use client";

import { useState, useCallback } from "react";
import { BankDepositClientService } from "../services/bankDepositClientService";
import { VaultAsset, ActiveBankAccount, DepositSlip } from "../types";

export function useBankDeposit() {
    const [vaultAssets, setVaultAssets] = useState<VaultAsset[]>([]);
    const [activeBanks, setActiveBanks] = useState<ActiveBankAccount[]>([]);
    const [history, setHistory] = useState<DepositSlip[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const fetchVaultAndBanks = useCallback(async () => {
        setIsLoading(true);
        try {
            const [vaultData, banksData] = await Promise.all([
                BankDepositClientService.getVaultAssets(),
                BankDepositClientService.getActiveBanks()
            ]);
            setVaultAssets(vaultData);
            setActiveBanks(banksData);
        } catch (err) {
            console.error("Failed to fetch vault data", err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const fetchHistory = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await BankDepositClientService.getDepositHistory();
            setHistory(data);
        } catch (err) {
            console.error("Failed to fetch history", err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const prepareDeposit = async (assetIds: number[], targetBankId: number, remarks: string): Promise<{ depositNo: string }> => {
        setIsSubmitting(true);
        try {
            const slip = await BankDepositClientService.prepareDeposit({ assetIds, targetBankId, remarks });
            await fetchVaultAndBanks();
            if (!slip) {
                throw new Error("Failed to generate deposit slip");
            }
            return { depositNo: slip.depositNo };
        } catch (err: unknown) {
            throw new Error(err instanceof Error ? err.message : "Failed to prepare deposit");
        } finally {
            setIsSubmitting(false);
        }
    };

    const clearDeposit = async (id: number) => {
        setIsSubmitting(true);
        try {
            await BankDepositClientService.clearDeposit(id);
            await fetchHistory();
        } catch (err: unknown) {
            throw new Error(err instanceof Error ? err.message : "Failed to clear deposit");
        } finally {
            setIsSubmitting(false);
        }
    };

    return {
        vaultAssets, activeBanks, history,
        isLoading, isSubmitting,
        fetchVaultAndBanks, fetchHistory, prepareDeposit, clearDeposit
    };
}