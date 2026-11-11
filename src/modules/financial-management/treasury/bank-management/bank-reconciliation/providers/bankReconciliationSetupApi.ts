import type { BankConfiguration, LedgerPage, MasterOptions, PeriodDraft, ReconciliationPeriod } from "../setup-types";
import type { AccountReference, CompanyReference } from "../reference-types";

const BASE = "/api/fm/treasury/bank-reconciliation";
export class SetupError extends Error {
  constructor(public status: number, message: string, public fieldErrors: Record<string, string> = {}) { super(message); }
}
export async function setupRequest<T>(path: string, method = "GET", body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${BASE}/${path}`, { method, credentials: "same-origin", cache: "no-store", ...(signal ? { signal } : {}), ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }) });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new SetupError(response.status, data?.message || "Bank Reconciliation request failed.", data?.fieldErrors || {});
  if (data === null) throw new SetupError(503, "The service returned an invalid response.");
  return data as T;
}
export const getBankConfiguration = (id: number) => setupRequest<BankConfiguration>(`banks/${id}/configuration`);
export const saveBankConfiguration = (id: number, version: number, companyId: number | null, glCoaId: number | null) => setupRequest<BankConfiguration>(`banks/${id}/configuration`, "PUT", { version, companyId, glCoaId });
export const getOpenPeriod = (bankId: number) => setupRequest<{ period: ReconciliationPeriod | null }>(`banks/${bankId}/open-period`);
export const getSetupPeriod = (id: number, closureId?: number) => setupRequest<ReconciliationPeriod>(`periods/${id}${closureId ? `?closureId=${closureId}` : ""}`);
export const saveSetupPeriod = (draft: PeriodDraft, id?: number) => setupRequest<ReconciliationPeriod>(id ? `periods/${id}` : "periods", id ? "PUT" : "POST", draft);
export const refreshSetupLedger = (period: ReconciliationPeriod) => setupRequest<ReconciliationPeriod>(`periods/${period.id}/ledger/refresh`, "POST", { version: period.version });
export const getSetupLedger = (id: number, page = 1) => setupRequest<LedgerPage>(`periods/${id}/ledger?page=${page}&pageSize=25`);
export const getSetupMasterOptions = () => setupRequest<MasterOptions>("master-options");
export function createSetupMaster(kind: "companies", body: unknown): Promise<CompanyReference>;
export function createSetupMaster(kind: "accounts", body: unknown): Promise<AccountReference>;
export function createSetupMaster(kind: "bank-accounts", body: unknown): Promise<BankConfiguration>;
export function createSetupMaster(kind: string, body: unknown) { return setupRequest(`masters/${kind}`, "POST", body); }
