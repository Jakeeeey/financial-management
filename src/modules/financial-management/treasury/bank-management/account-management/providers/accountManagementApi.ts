// src/modules/financial-management/treasury/bank-management/account-management/providers/accountManagementApi.ts
import type {
  AccountManagementData,
  AccountManagementFormValues,
  AccountStatusFilter,
  BankAccount,
} from "../types";

const BASE = "/api/fm/treasury/bank-management/account-management";

async function parseResponse<T>(res: Response, fallback: string): Promise<T> {
  const json = await res.json().catch(() => null);

  if (!res.ok) {
    const message =
      json && typeof json === "object" && "error" in json
        ? String((json as { error?: unknown }).error ?? fallback)
        : json && typeof json === "object" && "message" in json
          ? String((json as { message?: unknown }).message ?? fallback)
          : fallback;
    throw new Error(message);
  }

  return json as T;
}

export const accountManagementApi = {
  async getAccounts(query?: {
    page?: number;
    pageSize?: number;
    search?: string;
    status?: AccountStatusFilter;
  }): Promise<AccountManagementData> {
    const params = new URLSearchParams();
    if (query?.page) params.set("page", String(query.page));
    if (query?.pageSize) params.set("page_size", String(query.pageSize));
    if (query?.search) params.set("q", query.search);
    if (query?.status && query.status !== "all") params.set("status", query.status);

    const url = params.size > 0 ? `${BASE}?${params.toString()}` : BASE;
    const res = await fetch(url, { cache: "no-store" });
    return parseResponse<AccountManagementData>(res, "Failed to load bank accounts");
  },

  async createAccount(payload: AccountManagementFormValues): Promise<BankAccount> {
    const res = await fetch(BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await parseResponse<{ account: BankAccount }>(res, "Failed to create bank account");
    return json.account;
  },

  async updateAccount(id: number, payload: Partial<AccountManagementFormValues> & { isActive?: boolean }): Promise<BankAccount> {
    const res = await fetch(`${BASE}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await parseResponse<{ account: BankAccount }>(res, "Failed to update bank account");
    return json.account;
  },
};
