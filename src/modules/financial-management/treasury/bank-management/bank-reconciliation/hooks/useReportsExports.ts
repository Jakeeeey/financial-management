"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReportKey } from "../report-types";
import type { ReconciliationPeriod } from "../setup-types";
import { downloadReportsExport, getReportsCopyData } from "../providers/bankReconciliationReportsApi";
import { copiedReport } from "../services/reportsExport";

export function useReportsExports(period?: ReconciliationPeriod) {
  const selection = period ? `${period.id}:${period.lifecycle?.closureId || ""}:${period.version}` : "";
  const [state, setState] = useState({ selection: "", busy: "", error: "", message: "", manual: "" });
  const request = useRef<AbortController | null>(null), generation = useRef(0);
  const cancel = useCallback(() => { ++generation.current; request.current?.abort(); request.current = null; }, []);
  useEffect(() => cancel, [selection, cancel]);
  async function run(action: ReportKey | "xlsx" | "pdf") {
    if (!period || request.current) return;
    const controller = new AbortController(), token = ++generation.current; request.current = controller;
    setState({ selection, busy: action, error: "", message: "", manual: "" });
    const update = (value: Partial<typeof state>) => { if (token === generation.current) setState(previous => ({ ...previous, ...value })); };
    try {
      if (action === "xlsx" || action === "pdf") { await downloadReportsExport(period, action, controller.signal); update({ message: `${action === "xlsx" ? "Excel" : "PDF"} report generated. Your browser handles the download.` }); }
      else {
        const data = await getReportsCopyData(period, controller.signal); controller.signal.throwIfAborted(); const text = copiedReport(data, action);
        let copied = false;
        try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); copied = true; } } catch { /* Try the HTTP-compatible path below. */ }
        if (!copied) {
          const input = document.createElement("textarea"), focused = document.activeElement as HTMLElement | null; input.value = text; input.style.position = "fixed"; input.style.left = "-9999px"; document.body.append(input); input.focus(); input.select();
          try { copied = document.execCommand("copy"); } catch { copied = false; } finally { input.remove(); focused?.focus(); }
        }
        controller.signal.throwIfAborted(); update(copied ? { message: "Report copied." } : { manual: text, message: "Automatic copying is blocked. Select the report text and copy it manually." });
      }
    } catch (error) { if (!controller.signal.aborted) update({ error: error instanceof Error ? error.message : "Unable to export Reports." }); }
    finally { if (token === generation.current) { request.current = null; update({ busy: "" }); } }
  }
  const visible = state.selection === selection;
  return { busy: visible ? state.busy : "", error: visible ? state.error : "", message: visible ? state.message : "", manual: visible ? state.manual : "", dismiss: () => setState(previous => ({ ...previous, manual: "" })), run };
}
