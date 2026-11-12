"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FileDown, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ReconciliationPeriod } from "../setup-types";
import type { ReconcileExportFormat } from "../export-types";
import { downloadReconcileExport } from "../providers/bankReconciliationExportsApi";

export function ReconcileExports({ ready, busy, setBusy, run }: {
  ready: boolean; busy: boolean; setBusy: (value: boolean) => void;
  run: <T extends { period: ReconciliationPeriod }>(command: (period: ReconciliationPeriod) => Promise<T>) => Promise<T>;
}) {
  const [format, setFormat] = useState<ReconcileExportFormat | null>(null), [error, setError] = useState(""), [message, setMessage] = useState("");
  async function exportFile(kind: ReconcileExportFormat) {
    setFormat(kind); setBusy(true); setError(""); setMessage("");
    try { await run(async period => { await downloadReconcileExport(period, kind); return { period }; }); const message = `${kind === "xlsx" ? "Excel" : "PDF"} export generated.`; setMessage(message); toast.success(kind === "xlsx" ? "Reconcile Excel generated" : "Reconcile PDF generated", { id: "bank-rec-reconcile", description: kind === "xlsx" ? "The workbook is ready for download." : "The PDF is ready for download." }); }
    catch (e) { const message = e instanceof Error ? e.message : "Unable to export the reconciliation."; setError(message); toast.error("Reconcile export failed", { id: "bank-rec-reconcile-error", description: message, duration: 6000 }); }
    finally { setFormat(null); setBusy(false); }
  }
  return <section aria-label="Reconcile exports" className="space-y-2">
    <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" disabled={!ready || busy || format !== null} onClick={() => { void exportFile("xlsx"); }}><FileSpreadsheet className="size-4" />{format === "xlsx" ? "Generating Excel…" : "Export to Excel"}</Button><Button type="button" variant="outline" disabled={!ready || busy || format !== null} onClick={() => { void exportFile("pdf"); }}><FileDown className="size-4" />{format === "pdf" ? "Generating PDF…" : "Download PDF"}</Button></div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}{message && <p aria-live="polite" className="text-right text-xs text-muted-foreground">{message}</p>}
  </section>;
}
