"use client";

import type { ArfFinding, AuditLogRow, BankAccountV2, Paginated } from "../types";

type Envelope<T> = { success: boolean; data?: T; error?: string };

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, cache: "no-store" });
  const body = (await response.json().catch(() => null)) as Envelope<T> | null;
  if (!response.ok || !body?.success) {
    throw new Error(body?.error ?? "The request failed. Try again.");
  }
  return body.data as T;
}

function query(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "" || value === "ALL") continue;
    search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

export type AccountsFilter = { status?: string; currency?: string; q?: string; reconciliation?: string };
export type AuditFilter = { module?: string; from?: string; to?: string; page?: number; pageSize?: number };

export function fetchAccounts(filter: AccountsFilter) {
  return request<{ accounts: BankAccountV2[]; notice?: string }>(
    `/api/fm/treasury/bank-management-v2/bank-masterlist-audit-logs/accounts${query(filter)}`,
  );
}

export function fetchFindings() {
  return request<{ findings: ArfFinding[]; notice?: string }>(
    "/api/fm/treasury/bank-management-v2/bank-masterlist-audit-logs/arf",
  );
}

export function fetchAudit(filter: AuditFilter) {
  return request<Paginated<AuditLogRow> & { notice?: string }>(
    `/api/fm/treasury/bank-management-v2/bank-masterlist-audit-logs/audit${query(filter)}`,
  );
}
