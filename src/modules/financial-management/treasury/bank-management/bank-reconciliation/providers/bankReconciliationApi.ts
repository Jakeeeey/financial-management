// src/modules/financial-management/treasury/bank-management/bank-reconciliation/providers/bankReconciliationApi.ts
import type {
  BankReconciliation,
  BankReconciliationData,
  BankReconciliationFormValues,
  BankReconciliationQuery,
  BankReconciliationSystemBalancePreview,
  ReconciliationStatus,
} from "../types";

const BASE = "/api/fm/treasury/bank-management/bank-reconciliation";

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

export const bankReconciliationApi = {
  async getReconciliations(
    query?: BankReconciliationQuery,
  ): Promise<BankReconciliationData> {
    const params = new URLSearchParams();
    if (query?.page) params.set("page", String(query.page));
    if (query?.pageSize) params.set("page_size", String(query.pageSize));
    if (query?.search) params.set("q", query.search);
    if (query?.status && query.status !== "ALL") {
      params.set("status", query.status);
    }
    if (query?.bankId) params.set("bank_id", String(query.bankId));
    if (query?.startDate) params.set("start_date", query.startDate);
    if (query?.endDate) params.set("end_date", query.endDate);

    const url = params.size > 0 ? `${BASE}?${params.toString()}` : BASE;
    const res = await fetch(url, { cache: "no-store" });
    return parseResponse<BankReconciliationData>(
      res,
      "Failed to load bank reconciliations",
    );
  },

  async createReconciliation(
    payload: BankReconciliationFormValues,
  ): Promise<BankReconciliation> {
    const res = await fetch(BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bankId: Number(payload.bankId),
        statementDate: payload.statementDate,
        statementBalance: payload.statementBalance,
        remarks: payload.remarks,
      }),
    });
    const json = await parseResponse<{ reconciliation: BankReconciliation }>(
      res,
      "Failed to create bank reconciliation",
    );
    return json.reconciliation;
  },

  async getSystemBalancePreview(
    bankId: number,
    statementDate: string,
  ): Promise<BankReconciliationSystemBalancePreview> {
    const params = new URLSearchParams({
      bank_id: String(bankId),
      statement_date: statementDate,
    });
    const res = await fetch(`${BASE}/system-balance?${params.toString()}`, {
      cache: "no-store",
    });
    return parseResponse<BankReconciliationSystemBalancePreview>(
      res,
      "Failed to calculate system balance",
    );
  },

  async updateStatus(
    reconciliationId: number,
    status: ReconciliationStatus,
  ): Promise<{ id: number; status: ReconciliationStatus }> {
    const res = await fetch(
      `${BASE}/${reconciliationId}/status?status=${encodeURIComponent(status)}`,
      { method: "PATCH" },
    );
    const json = await parseResponse<{
      reconciliation: { id: number; status: ReconciliationStatus };
    }>(res, "Failed to update reconciliation status");
    return json.reconciliation;
  },
};
