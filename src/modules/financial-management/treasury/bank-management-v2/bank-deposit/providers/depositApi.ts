import type { DepositSlip, ResolvedJournalEntry, UndepositedAsset } from "../types";

export type DepositAccountOption = { bankId: number; label: string };

export type DepositSnapshot = {
  assets: UndepositedAsset[];
  slips: DepositSlip[];
  accounts: DepositAccountOption[];
};

async function unwrap<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as {
    success?: boolean;
    data?: T;
    error?: string;
    missingMappingKeys?: string[];
    fieldErrors?: Record<string, string[]>;
  };

  if (!response.ok || body.success === false) {
    const error = new Error(body.error || "Request failed.") as Error & {
      fieldErrors?: Record<string, string[]>;
      missingMappingKeys?: string[];
    };
    error.fieldErrors = body.fieldErrors;
    error.missingMappingKeys = body.missingMappingKeys;
    throw error;
  }
  return body.data as T;
}

export async function fetchDepositSnapshot(): Promise<DepositSnapshot> {
  return unwrap<DepositSnapshot>(await fetch("/api/fm/treasury/bank-management-v2/bank-deposit/assets", { cache: "no-store" }));
}

export type CreateSlipPayload = {
  bankAccountId: number;
  depositDate: string;
  slipNo: string;
  remarks: string | null;
  cashIds: number[];
  checkIds: number[];
};

export type CreateSlipResponse = {
  slip: DepositSlip;
  postingBlocked: { message: string; missingMappingKeys: string[] } | null;
  notice: string | null;
};

export async function createSlip(payload: CreateSlipPayload): Promise<CreateSlipResponse> {
  return unwrap<CreateSlipResponse>(
    await fetch("/api/fm/treasury/bank-management-v2/bank-deposit/slips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  );
}

export async function cancelSlip(slipId: number, reason: string): Promise<DepositSlip> {
  return unwrap<DepositSlip>(
    await fetch(`/api/fm/treasury/bank-management-v2/bank-deposit/slips/${slipId}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    }),
  );
}

/** E07 lines for the create dialog; the server resolves GL codes from `bank_gl_mapping`. */
export async function previewDepositSlip(payload: {
  bankAccountId: number;
  cashTotal: number;
}): Promise<ResolvedJournalEntry> {
  return unwrap<ResolvedJournalEntry>(
    await fetch("/api/fm/treasury/bank-management-v2/bank-deposit/slips/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  );
}
