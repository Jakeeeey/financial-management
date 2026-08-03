"use client";

import { useCallback, useRef, useState } from "react";
import { BankDepositClientService } from "../services/bankDepositClientService";
import {
    ActiveBankAccount,
    DepositSlip,
    VaultAsset,
    VaultAssetFilters,
} from "../types";

const DEFAULT_VAULT_FILTERS: VaultAssetFilters = {
    type: "ALL",
    documentNumber: "",
    dateFrom: "",
    dateTo: "",
    bankName: "",
};

export function useBankDeposit() {
    const [vaultAssets, setVaultAssets] = useState<VaultAsset[]>([]);
    const [activeBanks, setActiveBanks] = useState<ActiveBankAccount[]>([]);
    const [bankOptions, setBankOptions] = useState<string[]>([]);
    const [history, setHistory] = useState<DepositSlip[]>([]);
    const [filters, setFilters] = useState<VaultAssetFilters>(DEFAULT_VAULT_FILTERS);

    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [page, setPage] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [totalElements, setTotalElements] = useState(0);
    const pageSize = 50;

    const filtersRef = useRef(filters);
    const requestIdRef = useRef(0);

    const updateFilters = useCallback((nextFilters: VaultAssetFilters) => {
        filtersRef.current = nextFilters;
        setFilters(nextFilters);
    }, []);

    const applyVaultResponse = useCallback((response: {
        content: VaultAsset[];
        number: number;
        totalPages: number;
        totalElements: number;
        bankOptions?: string[];
    }) => {
        setVaultAssets(response.content);
        setPage(response.number);
        setTotalPages(response.totalPages);
        setTotalElements(response.totalElements);
        setBankOptions(response.bankOptions || []);
    }, []);

    const fetchVaultAndBanks = useCallback(async () => {
        const requestId = ++requestIdRef.current;
        setIsLoading(true);
        setError(null);

        try {
            const [vaultResponse, banksData] = await Promise.all([
                BankDepositClientService.getVaultAssets(0, pageSize, filtersRef.current),
                BankDepositClientService.getActiveBanks(),
            ]);

            if (requestId !== requestIdRef.current) return;
            if (!vaultResponse) throw new Error("Unable to load vault assets.");

            applyVaultResponse(vaultResponse);
            setActiveBanks(banksData);
        } catch (err: unknown) {
            if (requestId !== requestIdRef.current) return;
            const message = err instanceof Error ? err.message : "Unable to load vault assets.";
            setError(message);
            setVaultAssets([]);
        } finally {
            if (requestId === requestIdRef.current) setIsLoading(false);
        }
    }, [applyVaultResponse]);

    const fetchVaultPage = useCallback(async (
        targetPage: number,
        nextFilters: VaultAssetFilters = filtersRef.current,
    ) => {
        const requestId = ++requestIdRef.current;
        setIsLoading(true);
        setError(null);

        try {
            const vaultResponse = await BankDepositClientService.getVaultAssets(
                targetPage,
                pageSize,
                nextFilters,
            );

            if (requestId !== requestIdRef.current) return;
            if (!vaultResponse) throw new Error("Unable to load filtered vault assets.");

            applyVaultResponse(vaultResponse);
        } catch (err: unknown) {
            if (requestId !== requestIdRef.current) return;
            const message = err instanceof Error ? err.message : "Unable to load filtered vault assets.";
            setError(message);
            setVaultAssets([]);
        } finally {
            if (requestId === requestIdRef.current) setIsLoading(false);
        }
    }, [applyVaultResponse]);

    const fetchHistory = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await BankDepositClientService.getDepositHistory();
            setHistory(data);
        } catch {
            setError("Unable to load deposit history.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    const prepareDeposit = async (
        assetIds: number[],
        targetBankId: number,
        remarks: string,
    ): Promise<{ depositNo: string }> => {
        setIsSubmitting(true);
        try {
            const slip = await BankDepositClientService.prepareDeposit({ assetIds, targetBankId, remarks });
            await fetchVaultAndBanks();
            if (!slip) throw new Error("Failed to generate deposit slip");
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
        vaultAssets,
        activeBanks,
        bankOptions,
        history,
        filters,
        updateFilters,
        error,
        isLoading,
        isSubmitting,
        page,
        totalPages,
        totalElements,
        pageSize,
        fetchVaultAndBanks,
        fetchVaultPage,
        fetchHistory,
        prepareDeposit,
        clearDeposit,
    };
}
