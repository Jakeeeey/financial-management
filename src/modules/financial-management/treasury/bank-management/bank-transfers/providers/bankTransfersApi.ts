// src/modules/financial-management/treasury/bank-management/bank-transfers/providers/bankTransfersApi.ts
import type {
  BankTransfer,
  BankTransferFormValues,
  BankTransferQuery,
  BankTransfersData,
  TransferStatus,
} from "../types";

const BASE = "/api/fm/treasury/bank-management/bank-transfers";

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

export const bankTransfersApi = {
  async getTransfers(query?: BankTransferQuery): Promise<BankTransfersData> {
    const params = new URLSearchParams();
    if (query?.page) params.set("page", String(query.page));
    if (query?.pageSize) params.set("page_size", String(query.pageSize));
    if (query?.search) params.set("q", query.search);
    if (query?.status && query.status !== "ALL") {
      params.set("status", query.status);
    }
    if (query?.sourceBankId) {
      params.set("source_bank_id", String(query.sourceBankId));
    }
    if (query?.destinationBankId) {
      params.set("destination_bank_id", String(query.destinationBankId));
    }
    if (query?.startDate) params.set("start_date", query.startDate);
    if (query?.endDate) params.set("end_date", query.endDate);

    const url = params.size > 0 ? `${BASE}?${params.toString()}` : BASE;
    const res = await fetch(url, { cache: "no-store" });
    return parseResponse<BankTransfersData>(res, "Failed to load bank transfers");
  },

  async createTransfer(payload: BankTransferFormValues): Promise<BankTransfer> {
    const res = await fetch(BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transferDate: payload.transferDate,
        sourceBankId: Number(payload.sourceBankId),
        destinationBankId: Number(payload.destinationBankId),
        amount: payload.amount,
        transferFee: payload.transferFee,
        remarks: payload.remarks,
      }),
    });
    const json = await parseResponse<{ transfer: BankTransfer }>(
      res,
      "Failed to create bank transfer",
    );
    return json.transfer;
  },

  async updateStatus(
    transferId: number,
    status: TransferStatus,
  ): Promise<{ transferId: number; status: TransferStatus }> {
    const res = await fetch(
      `${BASE}/${transferId}/status?status=${encodeURIComponent(status)}`,
      { method: "PATCH" },
    );
    const json = await parseResponse<{
      transfer: { transferId: number; status: TransferStatus };
    }>(res, "Failed to update transfer status");
    return json.transfer;
  },
};
