"use client";

import type {
  DormancyAccount,
  DormancySnapshot,
  PreClosureResult,
  ActionOutcome,
} from "../types";

const BASE = "/api/fm/treasury/bank-management-v2/dormancy-account-closing";

type Envelope<T> = {
  success?: boolean;
  data?: T;
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string[]>;
  missingMappingKeys?: string[];
};

export class DormancyApiError extends Error {
  fieldErrors?: Record<string, string[]>;
  missingMappingKeys: string[];

  constructor(message: string, fieldErrors?: Record<string, string[]>, missingMappingKeys: string[] = []) {
    super(message);
    this.name = "DormancyApiError";
    this.fieldErrors = fieldErrors;
    this.missingMappingKeys = missingMappingKeys;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    cache: "no-store",
    ...init,
  });
  const payload = (await response.json().catch(() => ({}))) as Envelope<T>;
  if (!response.ok || payload.success === false) {
    throw new DormancyApiError(
      payload.error ?? payload.message ?? "The request failed.",
      payload.fieldErrors,
      payload.missingMappingKeys ?? [],
    );
  }
  return payload.data as T;
}

export function fetchDormancy(): Promise<DormancySnapshot> {
  return request<DormancySnapshot>("");
}

export function fetchPreClosure(bankId: number): Promise<PreClosureResult> {
  return request<PreClosureResult>(`/${bankId}/preclosure`);
}

export function reclassifyAccount(bankId: number): Promise<ActionOutcome> {
  return request<ActionOutcome>(`/${bankId}/reclassify`, { method: "POST", body: "{}" });
}

export function escheatAccount(bankId: number): Promise<ActionOutcome> {
  return request<ActionOutcome>(`/${bankId}/escheat`, { method: "POST", body: "{}" });
}

export function settleClosure(
  bankId: number,
  input: { accruedInterest: number; cutOff: string },
): Promise<ActionOutcome> {
  return request<ActionOutcome>(`/${bankId}/settle`, { method: "POST", body: JSON.stringify(input) });
}

export function lockAccountClosure(bankId: number, reason: string): Promise<ActionOutcome> {
  return request<ActionOutcome>(`/${bankId}/lock`, { method: "POST", body: JSON.stringify({ reason }) });
}

/** Options for the bank combobox, derived from the scanned accounts. */
export function bankOptions(accounts: DormancyAccount[]): Array<{ value: string; label: string }> {
  const names = [...new Set(accounts.map((account) => account.bankName))].filter(Boolean).sort();
  return names.map((name) => ({ value: name, label: name }));
}
