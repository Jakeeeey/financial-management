import { fetchProvider } from "../providers/fetchProvider";
import { VaultAsset, ActiveBankAccount, DepositSlip, PrepareDepositPayload, PaginatedResponse } from "../types";

export const BankDepositClientService = {

    getVaultAssets: async (page: number = 0, size: number = 50, search: string = ""): Promise<PaginatedResponse<VaultAsset> | null> => {
        return await fetchProvider.get<PaginatedResponse<VaultAsset>>(`/api/fm/treasury/bank-deposits/vault?page=${page}&size=${size}&search=${encodeURIComponent(search)}`);
    },

    getActiveBanks: async (): Promise<ActiveBankAccount[]> => {
        const data = await fetchProvider.get<ActiveBankAccount[]>("/api/fm/treasury/bank-accounts/active");
        return data || [];
    },

    // 🚀 FIXED: Changed /api/v1/ to /api/fm/
    getDepositHistory: async (): Promise<DepositSlip[]> => {
        const data = await fetchProvider.get<DepositSlip[]>("/api/fm/treasury/bank-deposits/history");
        return data || [];
    },

    // 🚀 FIXED: Changed /api/v1/ to /api/fm/
    prepareDeposit: async (payload: PrepareDepositPayload): Promise<DepositSlip | null> => {
        return await fetchProvider.post<DepositSlip>("/api/fm/treasury/bank-deposits/prepare", payload);
    },

    // 🚀 FIXED: Changed /api/v1/ to /api/fm/
    clearDeposit: async (id: number): Promise<{ message: string } | null> => {
        return await fetchProvider.post<{ message: string }>(`/api/fm/treasury/bank-deposits/${id}/clear`, {});
    },

    // 🚀 FIXED: Changed /api/v1/ to /api/fm/
    bounceCheck: async (detailId: number, remarks: string): Promise<{ message: string } | null> => {
        return await fetchProvider.post<{ message: string }>(`/api/fm/treasury/bank-deposits/details/${detailId}/bounce`, { remarks });
    }
};