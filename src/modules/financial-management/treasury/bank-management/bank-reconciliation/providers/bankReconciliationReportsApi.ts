import type { AuditEvent, ClosedPeriod, FinancialReports, HistoryPage, ReportsExportData } from "../report-types";
import type { ReconciliationPeriod } from "../setup-types";
import { SetupError } from "./bankReconciliationSetupApi";

export async function getFinancialReports(id: number, closureId?: number, signal?: AbortSignal): Promise<FinancialReports> {
  const response = await fetch(`/api/fm/treasury/bank-reconciliation/periods/${id}/reports${closureId ? `?closureId=${closureId}` : ""}`, { credentials: "same-origin", cache: "no-store", signal });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new SetupError(response.status, data?.message || "Unable to load financial reports.");
  if (!data) throw new SetupError(503, "The service returned an invalid response.");
  return data;
}

async function history<T>(id: number, section: string, page: number, boundary: string, through?: number, signal?: AbortSignal): Promise<HistoryPage<T>> {
  const query = new URLSearchParams({ page: String(page), pageSize: "25" });
  if (through !== undefined) query.set(boundary, String(through));
  const response = await fetch(`/api/fm/treasury/bank-reconciliation/periods/${id}/reports/${section}?${query}`, { credentials: "same-origin", cache: "no-store", signal });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new SetupError(response.status, data?.message || "Unable to load report history.");
  if (!data || !Array.isArray(data.items)) throw new SetupError(503, "The service returned an invalid history response.");
  return data;
}
export const getAuditHistory = (id: number, page: number, through?: number, signal?: AbortSignal) => history<AuditEvent>(id, "audit", page, "throughEventId", through, signal);
export const getClosedPeriods = (id: number, page: number, through?: number, signal?: AbortSignal) => history<ClosedPeriod>(id, "closed-periods", page, "throughClosureId", through, signal);

export async function getReportsCopyData(period: ReconciliationPeriod, signal?: AbortSignal): Promise<ReportsExportData> {
  const query = new URLSearchParams({ version: String(period.version), bankVersion: String(period.bank.version), format: "text" });
  if (period.lifecycle?.closureId) query.set("closureId", String(period.lifecycle.closureId));
  const response = await fetch(`/api/fm/treasury/bank-reconciliation/periods/${period.id}/reports/export-data?${query}`, { credentials: "same-origin", cache: "no-store", signal });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new SetupError(response.status, data?.message || "Unable to prepare the copied report.");
  if (!data || !Array.isArray(data.audit) || !Array.isArray(data.closedPeriods)) throw new SetupError(503, "The service returned an invalid report snapshot.");
  return data;
}
export async function downloadReportsExport(period: ReconciliationPeriod, format: "xlsx" | "pdf", signal?: AbortSignal) {
  const response = await fetch(`/api/fm/treasury/bank-reconciliation/periods/${period.id}/reports/exports/${format}`, { method: "POST", credentials: "same-origin", cache: "no-store", signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version: period.version, bankVersion: period.bank.version, ...(period.lifecycle?.closureId ? { closureId: period.lifecycle.closureId } : {}) }) });
  if (!response.ok) { const data = await response.json().catch(() => null); throw new SetupError(response.status, data?.message || "Unable to export Reports."); }
  if (!response.headers.get("Content-Type")?.includes(format === "pdf" ? "application/pdf" : "spreadsheetml")) throw new SetupError(503, "The service did not return an export file. Please retry.");
  const blob = await response.blob(); signal?.throwIfAborted(); const url = URL.createObjectURL(blob), link = document.createElement("a"); link.href = url; link.download = response.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] || `Bank-rec_Reports.${format}`;
  document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
