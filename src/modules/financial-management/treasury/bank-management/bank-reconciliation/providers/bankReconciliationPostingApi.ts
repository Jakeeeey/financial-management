import type { PostingAction, PostingCommand, PostingData, PostingReceipt, ImportedJournalChoice } from "../posting-types";
import { SetupError, setupRequest } from "./bankReconciliationSetupApi";

const BASE = "/api/fm/treasury/bank-reconciliation";
async function read<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${BASE}/${path}`, { credentials: "same-origin", cache: "no-store", signal });
  const body = await response.json().catch(() => null);
  if (!response.ok || body === null) throw new SetupError(response.ok ? 503 : response.status, body?.message || "Unable to load Posting. Please retry.");
  return body as T;
}
export const getPostingPeriod = (id: number, signal?: AbortSignal, closureId?: number) => read<PostingData>(`periods/${id}/posting${closureId ? `?closureId=${closureId}` : ""}`, signal);
export const getBankPostingPeriod = (id: number, signal?: AbortSignal) => read<{ periodId: number | null }>(`banks/${id}/posting-period`, signal);
export const savePostingDate = (period: PostingData["period"], postingDate: string | null) => setupRequest<PostingData>(`periods/${period.id}/posting-date`, "PUT", { version: period.version, postingDate });
export const runPostingCommand = (periodId: number, action: PostingAction, command: PostingCommand) => setupRequest<PostingReceipt>(`periods/${periodId}/posting/${action}`, "POST", command);
export const getPostingReceipt = (periodId: number, requestId: string) => read<PostingReceipt>(`periods/${periodId}/posting-requests/${requestId}`);
export const getImportedJournalChoices = (periodId: number, journalId: number) => read<{ items: ImportedJournalChoice[] }>(`periods/${periodId}/journals/${journalId}/gl-candidates`);
export async function downloadPostingExport(period: PostingData["period"], format: "xlsx" | "pdf") {
  const response = await fetch(`${BASE}/periods/${period.id}/posting/exports/${format}`, { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version: period.version, bankVersion: period.bank.version, ...(period.lifecycle?.closureId ? { closureId: period.lifecycle.closureId } : {}) }) });
  if (!response.ok) { const error = await response.json().catch(() => null); throw new SetupError(response.status, error?.message || "Unable to export Posting."); }
  if (!response.headers.get("Content-Type")?.includes(format === "pdf" ? "application/pdf" : "spreadsheetml")) throw new SetupError(503, "The service did not return an export file. Please retry.");
  const url = URL.createObjectURL(await response.blob()), link = document.createElement("a"); link.href = url; link.download = response.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] || `Bank-rec_Posting.${format}`;
  document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function downloadFallbackJournal(periodId: number, requestId: string) {
  const response = await fetch(`${BASE}/periods/${periodId}/journal-file/${requestId}`, { method: "POST", credentials: "same-origin", cache: "no-store" });
  if (!response.ok) { const error = await response.json().catch(() => null); throw new SetupError(response.status, error?.message || "Unable to generate the fallback journal file."); }
  const blob = await response.blob(), url = URL.createObjectURL(blob), link = document.createElement("a"); link.href = url; link.download = response.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] || "Bank-rec_Journal-import.xlsx";
  document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
