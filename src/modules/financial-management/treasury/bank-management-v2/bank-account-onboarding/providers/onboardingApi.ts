import type { OnboardingFilterState, OnboardingListing, RegisterAccountResult, UpdateAccountResult } from "../types";

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
  status: string;
  effectiveDate: string;
};

/** Edits an onboarded account; status drives `is_active` on the server. */
export async function updateAccount(id: number, payload: UpdateAccountPayload): Promise<UpdateAccountResult> {
  return unwrap<UpdateAccountResult>(
    await fetch(`${BASE}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  );
}
