"use client";

import type { ArfFinding, AuditLogRow, BankAccountV2, Paginated } from "../types";

type Envelope<T> = { success: boolean; data?: T; error?: string };

const BASE = "/api/fm/treasury/bank-management-v2/bank-masterlist-audit-logs";

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

export type AccountsFilter = {
  status?: string;
  currency?: string;
  type?: string;
  ifrs?: string;
  q?: string;
  reconciliation?: string;
};

export type AuditFilter = {
  module?: string;
  user?: string;
  pht?: string;
  q?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
};

export type AuditFacets = { modules: string[]; users: string[] };

export function fetchAccounts(filter: AccountsFilter) {
  return request<{ accounts: BankAccountV2[]; notice?: string }>(`${BASE}/accounts${query(filter)}`);
}

export function fetchFindings() {
  return request<{ findings: ArfFinding[]; notice?: string }>(`${BASE}/arf`);
}

export function fetchAudit(filter: AuditFilter) {
  return request<Paginated<AuditLogRow> & { notice?: string; facets: AuditFacets }>(
    `${BASE}/audit${query(filter)}`,
  );
}

