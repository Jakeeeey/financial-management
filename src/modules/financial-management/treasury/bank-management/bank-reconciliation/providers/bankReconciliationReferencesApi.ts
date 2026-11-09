import { BANK_RECONCILIATION_ROOT } from "../workspaces";
import type { BankReconciliationContext, BankReconciliationReferencePage, BankReconciliationReferenceQuery, BankReconciliationReferenceResource, BankReconciliationReferences } from "../reference-types";

const BASE = `/api${BANK_RECONCILIATION_ROOT}`;

export class BankReconciliationReferenceError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

async function read<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${BASE}${path}`, { method: "GET", credentials: "same-origin", cache: "no-store", signal });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new BankReconciliationReferenceError(response.status, typeof body?.message === "string" ? body.message : "Unable to load Bank Reconciliation references.");
  if (body === null) throw new BankReconciliationReferenceError(503, "The reference service returned an invalid response.");
  return body as T;
}

export function getBankReconciliationContext(signal?: AbortSignal) {
  return read<BankReconciliationContext>("/context", signal);
}

export function searchBankReconciliationReferences<K extends BankReconciliationReferenceResource>(resource: K, query: BankReconciliationReferenceQuery = {}, signal?: AbortSignal) {
  const params = new URLSearchParams();
  if (query.search !== undefined) params.set("search", query.search);
  if (query.page !== undefined) params.set("page", String(query.page));
  if (query.pageSize !== undefined) params.set("pageSize", String(query.pageSize));
  return read<BankReconciliationReferencePage<BankReconciliationReferences[K]>>(`/lookups/${encodeURIComponent(resource)}?${params}`, signal);
}

export function getBankReconciliationReference<K extends BankReconciliationReferenceResource>(resource: K, id: number, signal?: AbortSignal) {
  return read<BankReconciliationReferences[K]>(`/lookups/${encodeURIComponent(resource)}/${encodeURIComponent(id)}`, signal);
}
