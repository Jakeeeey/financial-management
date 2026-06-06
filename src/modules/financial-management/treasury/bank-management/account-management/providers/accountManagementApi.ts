// src/modules/financial-management/treasury/bank-management/account-management/providers/accountManagementApi.ts
import type {
  AccountManagementData,
  AccountManagementFieldErrors,
  AccountManagementFormValues,
  AccountManagementQuery,
  BankAccount,
  BankNameOption,
  PsgcOption,
} from "../types";

const BASE = "/api/fm/treasury/bank-management/account-management";

export class AccountManagementApiError extends Error {
  fieldErrors?: AccountManagementFieldErrors;

  constructor(message: string, fieldErrors?: AccountManagementFieldErrors) {
    super(message);
    this.name = "AccountManagementApiError";
    this.fieldErrors = fieldErrors;
  }
}

async function parseResponse<T>(res: Response, fallback: string): Promise<T> {
  const json = await res.json().catch(() => null);

  if (!res.ok) {
    const fieldErrors =
      json && typeof json === "object" && "fieldErrors" in json
        ? ((json as { fieldErrors?: AccountManagementFieldErrors }).fieldErrors)
        : undefined;
    const message =
      json && typeof json === "object" && "error" in json
        ? String((json as { error?: unknown }).error ?? fallback)
        : json && typeof json === "object" && "message" in json
          ? String((json as { message?: unknown }).message ?? fallback)
          : fallback;
    throw new AccountManagementApiError(message, fieldErrors);
  }

  return json as T;
}

export const accountManagementApi = {
  async getAccounts(query?: AccountManagementQuery): Promise<AccountManagementData> {
    const params = new URLSearchParams();
    if (query?.page) params.set("page", String(query.page));
    if (query?.pageSize) params.set("page_size", String(query.pageSize));
    if (query?.search) params.set("q", query.search);
    if (query?.status && query.status !== "all")
      params.set("status", query.status);
    if (query?.bankName) params.set("bank_name", query.bankName);
    if (query?.accountType) params.set("account_type", query.accountType);
    if (query?.accountName) params.set("account_name", query.accountName);
    if (query?.createdFrom) params.set("created_from", query.createdFrom);
    if (query?.createdTo) params.set("created_to", query.createdTo);

    const url = params.size > 0 ? `${BASE}?${params.toString()}` : BASE;
    const res = await fetch(url, { cache: "no-store" });
    return parseResponse<AccountManagementData>(
      res,
      "Failed to load bank accounts",
    );
  },

  async createAccount(
    payload: AccountManagementFormValues,
  ): Promise<BankAccount> {
    const res = await fetch(BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await parseResponse<{ account: BankAccount }>(
      res,
      "Failed to create bank account",
    );
    return json.account;
  },

  async updateAccount(
    bankId: number,
    payload: Partial<AccountManagementFormValues> & { isActive?: boolean },
  ): Promise<BankAccount> {
    const res = await fetch(`${BASE}/${bankId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await parseResponse<{ account: BankAccount }>(
      res,
      "Failed to update bank account",
    );
    return json.account;
  },

  async createBankName(
    bankName: string,
    allowDuplicate = false,
  ): Promise<BankNameOption> {
    const res = await fetch(`${BASE}/bank-names`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bankName, allowDuplicate }),
    });
    const json = await parseResponse<{ bankName: BankNameOption }>(
      res,
      "Failed to add bank name",
    );
    return json.bankName;
  },

  async getPsgcOptions(query: {
    kind: "provinces" | "cities" | "barangays";
    provinceCode?: string;
    cityCode?: string;
  }): Promise<PsgcOption[]> {
    const params = new URLSearchParams({ kind: query.kind });
    if (query.provinceCode) params.set("province_code", query.provinceCode);
    if (query.cityCode) params.set("city_code", query.cityCode);

    const res = await fetch(`${BASE}/psgc?${params.toString()}`, {
      cache: "no-store",
    });
    const json = await parseResponse<{ options: PsgcOption[] }>(
      res,
      "Failed to load PSGC address data",
    );
    return json.options;
  },
};
