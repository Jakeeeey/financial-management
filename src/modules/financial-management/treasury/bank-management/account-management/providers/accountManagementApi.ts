// src/modules/financial-management/treasury/bank-management/account-management/providers/accountManagementApi.ts
import type {
  AccountManagementData,
  AccountManagementFormValues,
  AccountStatusFilter,
  BankAccount,
  BankNameOption,
  CreateBankNameResult,
  PsgcOption,
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
    if (query?.status && query.status !== "all")
      params.set("status", query.status);

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
  ): Promise<CreateBankNameResult> {
    const res = await fetch(`${BASE}/bank-names`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bankName, allowDuplicate }),
    });
    const json = await res.json().catch(() => null);

    if (res.status === 409 && json && typeof json === "object") {
      const body = json as {
        bankName?: unknown;
        duplicate?: unknown;
        message?: unknown;
      };

      if (body.duplicate) {
        return {
          status: "duplicate",
          bankName: String(body.bankName ?? bankName).trim(),
          message: String(
            body.message ?? "A bank name with this value already exists",
          ),
        };
      }
    }

    if (!res.ok) {
      const message =
        json && typeof json === "object" && "error" in json
          ? String(
              (json as { error?: unknown }).error ?? "Failed to add bank name",
            )
          : json && typeof json === "object" && "message" in json
            ? String(
                (json as { message?: unknown }).message ??
                  "Failed to add bank name",
              )
            : "Failed to add bank name";
      throw new Error(message);
    }

    return {
      status: "created",
      bankName: (json as { bankName: BankNameOption }).bankName,
    };
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
