import type { ReconcileExportFormat } from "../export-types";
import type { ReconciliationPeriod } from "../setup-types";
import { SetupError } from "./bankReconciliationSetupApi";

export async function downloadReconcileExport(period: ReconciliationPeriod, format: ReconcileExportFormat) {
  const response = await fetch(`/api/fm/treasury/bank-reconciliation/periods/${period.id}/exports/${format}`, { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version: period.version, bankVersion: period.bank.version }) });
  if (!response.ok) { const data = await response.json().catch(() => null); throw new SetupError(response.status, data?.message || "Unable to export the reconciliation."); }
  if (!response.headers.get("content-type")?.includes(format === "pdf" ? "application/pdf" : "spreadsheetml")) throw new SetupError(503, "The service did not return an export file. Please retry.");
  const blob = await response.blob(), url = URL.createObjectURL(blob), link = document.createElement("a");
  link.href = url; link.download = response.headers.get("content-disposition")?.match(/filename="([^"]+)"/)?.[1] || `Bank-rec_Reconcile.${format}`;
  document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
