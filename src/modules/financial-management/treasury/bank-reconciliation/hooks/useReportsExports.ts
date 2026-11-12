"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReportKey } from "../report-types";
import type { ReconciliationPeriod } from "../setup-types";
import { downloadReportsExport, getReportsCopyData } from "../providers/bankReconciliationReportsApi";
import { copiedReport } from "../services/reportsExport";
import { SetupError } from "../providers/bankReconciliationSetupApi";
import { toast } from "sonner";

type ReportAction = ReportKey | "xlsx" | "pdf" | "";
type ExportState = { selection: string; token: number; action: ReportAction; busy: ReportAction; error: string; message: string; manual: string; recovery: "retry" | "refresh" | "" };

export function useReportsExports(period?: ReconciliationPeriod) {
  const selection = period ? `${period.id}:${period.lifecycle?.closureId || ""}:${period.version}` : "";
  const [state, setState] = useState<ExportState>({ selection: "", token: 0, action: "", busy: "", error: "", message: "", manual: "", recovery: "" });
  const request = useRef<AbortController | null>(null), generation = useRef(0);
  const cancel = useCallback(() => { ++generation.current; request.current?.abort(); request.current = null; }, []);
  useEffect(() => cancel, [selection, cancel]);
  async function run(action: ReportKey | "xlsx" | "pdf") {
    if (!period || request.current) return;
    const controller = new AbortController(), token = ++generation.current; request.current = controller;
    setState({ selection, token, action, busy: action, error: "", message: "", manual: "", recovery: "" });
    const update = (value: Partial<typeof state>) => { if (token === generation.current) setState(previous => ({ ...previous, ...value })); };
    try {
      if (action === "xlsx" || action === "pdf") { await downloadReportsExport(period, action, controller.signal); const message = `${action === "xlsx" ? "Excel" : "PDF"} report generated. Your browser handles the download.`; update({ message }); toast.success(`Reports ${action === "xlsx" ? "Excel" : "PDF"} generated`, { id: "bank-rec-reports", description: message }); }
      else {
        const data = await getReportsCopyData(period, controller.signal); controller.signal.throwIfAborted(); const text = copiedReport(data, action);
        let copied = false;
        try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); copied = true; } } catch { /* Try the HTTP-compatible path below. */ }
        controller.signal.throwIfAborted();
        if (!copied) {
          const input = document.createElement("textarea"), focused = document.activeElement as HTMLElement | null; input.value = text; input.style.position = "fixed"; input.style.left = "-9999px"; document.body.append(input); input.focus({ preventScroll: true }); input.select();
          try { copied = document.execCommand("copy"); } catch { copied = false; } finally { input.remove(); focused?.focus({ preventScroll: true }); }
        }
        controller.signal.throwIfAborted(); update(copied ? { message: "Report copied." } : { manual: text, message: "Automatic copying is blocked. Use Copy to open the text for manual copying." });
      }
    } catch (error) { if (!controller.signal.aborted) { const message = error instanceof Error ? error.message : "Unable to export Reports."; update({ error: message, recovery: error instanceof SetupError && error.status === 409 ? "refresh" : !(error instanceof SetupError) || error.status >= 500 || error.status === 429 ? "retry" : "" }); if (action === "xlsx" || action === "pdf") toast.error("Reports export failed", { id: "bank-rec-reports-error", description: message, duration: 6000 }); } }
    finally { if (token === generation.current) { request.current = null; update({ busy: "" }); } }
  }
  const visible = state.selection === selection && state.token === generation.current;
  return { action: visible ? state.action : "", busy: visible ? state.busy : "", error: visible ? state.error : "", message: visible ? state.message : "", recovery: visible ? state.recovery : "", manual: visible ? state.manual : "", dismiss: () => setState(previous => ({ ...previous, manual: "" })), run };
}
