import type {
  GlMappingRow,
  OnboardingFilterState,
  OnboardingListing,
  RegisterAccountResult,
  UpdateAccountResult,
} from "../types";

export type OnboardingApiError = Error & {
  fieldErrors?: Record<string, string[]>;
  missingMappingKeys?: string[];
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
    const error = new Error(body.error || "Request failed.") as OnboardingApiError;
    error.fieldErrors = body.fieldErrors;
    error.missingMappingKeys = body.missingMappingKeys;
    throw error;
  }
  return body.data as T;
}

const BASE = "/api/fm/treasury/bank-management-v2/bank-account-onboarding";

/** One round trip for the register page: rows, filters' options and pagination. */
export async function fetchOnboarding(
  filters: OnboardingFilterState,
  page: number,
  pageSize: number,
): Promise<OnboardingListing> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  for (const [key, value] of Object.entries(filters)) {
    if (value !== "" && value !== "ALL") params.set(key, value);
  }
  return unwrap<OnboardingListing>(await fetch(`${BASE}?${params.toString()}`, { cache: "no-store" }));
}

export type RegisterAccountPayload = {
  bankName: string;
  branch: string;
  accountNumber: string;
  accountName: string;
  accountType: string;
  glCoaId: number;
  openingBalance: number;
  effectiveDate: string;
  remarks?: string;
};

/** Creates the account; the route answers 201 with the posting outcome. */
export async function registerAccount(payload: RegisterAccountPayload): Promise<RegisterAccountResult> {
  return unwrap<RegisterAccountResult>(
    await fetch(BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  );
}

export type UpdateAccountPayload = {
  accountName: string;
  branch: string;
  accountType: string;
  glCoaId: number;
  /** Undoes a deactivation. Every other lifecycle move belongs to Dormancy & Account Closing. */
  reactivate: boolean;
  effectiveDate: string;
  remarks?: string;
};

/** Edits an onboarded account's master data, or reactivates it. */
export async function updateAccount(id: number, payload: UpdateAccountPayload): Promise<UpdateAccountResult> {
  return unwrap<UpdateAccountResult>(
    await fetch(`${BASE}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  );
}

export type PostOpeningBalanceResult = { posted: boolean; notice?: string };

/** Retries E01 for an account whose opening balance never posted. */
export async function postOpeningBalance(id: number): Promise<PostOpeningBalanceResult> {
  return unwrap<PostOpeningBalanceResult>(
    await fetch(`${BASE}/${id}/post-opening-balance`, { method: "POST" }),
  );
}

export type SaveMappingResult = { mapping: GlMappingRow[]; dueTransfers: number };

/** Saves one posting-setup row; the answer says whether due transfers can now settle. */
export async function saveMapping(mappingKey: string, coaId: number | null): Promise<SaveMappingResult> {
  return unwrap<SaveMappingResult>(
    await fetch(`${BASE}/gl-mapping`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ updates: [{ mappingKey, coaId }] }),
    }),
  );
}

export type SettleDueResult = {
  settled: number;
  jeNos: string[];
  failed: Array<{ id: number; transferNo: string; error: string }>;
};

/** The same settle-many path the clearing panel uses, reached from the mapping prompt. */
export async function settleDueTransfers(): Promise<SettleDueResult> {
  return unwrap<SettleDueResult>(
    await fetch("/api/fm/treasury/bank-management-v2/cash-bank-transactions/transfers/settle-due", {
      method: "POST",
    }),
  );
}
