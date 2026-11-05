"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const BASE = "/api/fm/accounting/customer-credit-memo/customers-memo/export";
export function useMemoExcelExport() {
  const active = useRef<AbortController | null>(null);
  const [exporting, setExporting] = useState<"summary" | number | null>(null);
  useEffect(() => () => { active.current?.abort(); }, []);

  async function download(key: "summary" | number, memoIds?: number[], filters?: string[]) {
    if (active.current) return;
    const controller = new AbortController(); active.current = controller; setExporting(key);
    try {
      const response = await fetch(`${BASE}/${key}`, { method: key === "summary" ? "POST" : "GET", cache: "no-store", signal: controller.signal,
        ...(key === "summary" ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ memoIds, filters }) } : {}) });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || (response.status === 401 ? "Your session expired. Please sign in and retry the export."
          : response.status === 403 ? "You do not have permission to export customer memos." : "Unable to download the memo export. Please retry."));
      }
      if (!response.headers.get("Content-Type")?.includes("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
        throw new Error("The server did not return an Excel workbook. Please sign in again or retry.");
      const blob = await response.blob(); controller.signal.throwIfAborted();
      const filename = response.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1]?.replace(/[^a-zA-Z0-9._-]/g, "_") || `Customer_Memo_${key}.xlsx`;
      const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename;
      document.body.appendChild(anchor); anchor.click(); anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success(key === "summary" ? "Customer memo summary exported." : "Customer memo exported.");
    } catch (error) {
      if (!controller.signal.aborted) toast.error(error instanceof Error ? error.message : "Unable to export customer memos.");
    } finally { active.current = null; if (!controller.signal.aborted) setExporting(null); }
  }
  return { exporting, exportSummary: (ids: number[], filters: string[]) => download("summary", ids, filters), exportMemo: (id: number) => download(id) };
}
