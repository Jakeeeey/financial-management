import { fetchProvider } from "../providers/fetchProvider";
import { VaultAsset, ActiveBankAccount, DepositSlip, PrepareDepositPayload } from "../types";

export const BankDepositClientService = {

    getVaultAssets: async (): Promise<VaultAsset[]> => {
        const data = await fetchProvider.get<VaultAsset[]>("/api/fm/treasury/bank-deposits/vault");
        return data || [];
    },

    getActiveBanks: async (): Promise<ActiveBankAccount[]> => {
        const data = await fetchProvider.get<ActiveBankAccount[]>("/api/fm/treasury/bank-accounts/active");
        return data || [];
    },

    getDepositHistory: async (): Promise<DepositSlip[]> => {
        const data = await fetchProvider.get<DepositSlip[]>("/api/fm/treasury/bank-deposits/history");
        return data || [];
    },

    prepareDeposit: async (payload: PrepareDepositPayload): Promise<DepositSlip | null> => {
        return await fetchProvider.post<DepositSlip>("/api/fm/treasury/bank-deposits/prepare", payload);
    },

    clearDeposit: async (id: number): Promise<{ message: string } | null> => {
        return await fetchProvider.post<{ message: string }>(`/api/fm/treasury/bank-deposits/${id}/clear`, {});
    },

    bounceCheck: async (detailId: number, remarks: string): Promise<{ message: string } | null> => {
        return await fetchProvider.post<{ message: string }>(`/api/fm/treasury/bank-deposits/details/${detailId}/bounce`, { remarks });
    }
};