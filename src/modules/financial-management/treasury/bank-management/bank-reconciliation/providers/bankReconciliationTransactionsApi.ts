import { setupRequest, SetupError } from "./bankReconciliationSetupApi";
import type { ReconciliationPeriod } from "../setup-types";
import type { TransactionData, TransactionFilter, TransactionResult, TransactionSide } from "../transaction-types";

const BASE = "/api/fm/treasury/bank-reconciliation";
export function getTransactions(id: number, filter: TransactionFilter, search: string, bankPage: number, ledgerPage: number, closureId?: number, signal?: AbortSignal) {
  const query = new URLSearchParams({ filter, search, bankPage: String(bankPage), ledgerPage: String(ledgerPage), pageSize: "25" });
  if (closureId) query.set("closureId", String(closureId));
  return setupRequest<TransactionData>(`periods/${id}/transactions?${query}`, "GET", undefined, signal);
}
export const addTransaction = (period: ReconciliationPeriod, side: TransactionSide, draft: { date: string; reference: string; description: string; amount: string }) => setupRequest<TransactionResult>(`periods/${period.id}/lines/${side}`, "POST", { ...draft, version: period.version });
export const deleteTransaction = (period: ReconciliationPeriod, side: TransactionSide, id: number) => setupRequest<TransactionResult>(`periods/${period.id}/lines/${side}/${id}`, "DELETE", { version: period.version });
export const matchTransactions = (period: ReconciliationPeriod, bankLineIds: number[], ledgerLineIds: number[], classification: string | null, offsetAccountId: number | null) => setupRequest<TransactionResult>(`periods/${period.id}/matches`, "POST", { version: period.version, bankLineIds, ledgerLineIds, classification, offsetAccountId });
export const autoMatchTransactions = (period: ReconciliationPeriod) => setupRequest<TransactionResult>(`periods/${period.id}/matches/auto`, "POST", { version: period.version });
export const undoTransactionMatches = (period: ReconciliationPeriod) => setupRequest<TransactionResult>(`periods/${period.id}/matches/undo`, "POST", { version: period.version });
export const unmatchTransactions = (period: ReconciliationPeriod, id: number) => setupRequest<TransactionResult>(`periods/${period.id}/matches/${id}`, "DELETE", { version: period.version });
export const setBankTreatment = (period: ReconciliationPeriod, id: number, treatment: string) => setupRequest<TransactionResult>(`periods/${period.id}/lines/BANK/${id}/treatment`, "PUT", { version: period.version, treatment });
export const setBankOffset = (period: ReconciliationPeriod, id: number, offsetAccountId: number | null) => setupRequest<TransactionResult>(`periods/${period.id}/lines/BANK/${id}/offset-account`, "PUT", { version: period.version, offsetAccountId });
export const setMatchOffset = (period: ReconciliationPeriod, id: number, offsetAccountId: number | null) => setupRequest<TransactionResult>(`periods/${period.id}/matches/${id}/offset-account`, "PUT", { version: period.version, offsetAccountId });
export async function importTransactions(period: ReconciliationPeriod, side: TransactionSide, file: File, requestId: string): Promise<TransactionResult> {
  const body = new FormData(); body.set("file", file); body.set("version", String(period.version)); body.set("requestId", requestId);
  const response = await fetch(`${BASE}/periods/${period.id}/imports/${side}`, { method: "POST", body, credentials: "same-origin", cache: "no-store" });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new SetupError(response.status, data?.message || "The import result is unavailable. Retry this upload safely.");
  if (!data?.report || !data?.period) throw new SetupError(502, "The import result is unavailable. Retry this upload safely.");
  return data;
}
export async function downloadTransactionTemplate(side: TransactionSide) {
  const response = await fetch(`${BASE}/templates/${side}`, { credentials: "same-origin", cache: "no-store" });
  if (!response.ok) { const data = await response.json().catch(() => null); throw new SetupError(response.status, data?.message || "Unable to download the template."); }
  return response.blob();
}
