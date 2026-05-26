// src/modules/financial-management/treasury/bank-management/unified-bank-ledger/providers/unifiedBankLedgerApi.ts
import type {
  UnifiedBankLedgerData,
  UnifiedBankLedgerQuery,
} from "../types";

const BASE = "/api/fm/treasury/bank-management/unified-bank-ledger";

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

export const unifiedBankLedgerApi = {
  async getLedger(
    query?: UnifiedBankLedgerQuery,
  ): Promise<UnifiedBankLedgerData> {
    const params = new URLSearchParams();
    if (query?.bankId) params.set("bank_id", String(query.bankId));
    if (query?.startDate) params.set("start_date", query.startDate);
    if (query?.endDate) params.set("end_date", query.endDate);
    if (query?.page) params.set("page", String(query.page));
    if (query?.pageSize) params.set("page_size", String(query.pageSize));

    const url = params.size > 0 ? `${BASE}?${params.toString()}` : BASE;
    const res = await fetch(url, { cache: "no-store" });
    return parseResponse<UnifiedBankLedgerData>(
      res,
      "Failed to load unified bank ledger",
    );
  },
};
