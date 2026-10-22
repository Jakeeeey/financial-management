"use client";

import { useState } from "react";
import { useTrialBalance } from "../hooks/useTrialBalance";
import {
  exportTrialBalanceToExcel,
  exportTrialBalanceToPdf,
} from "../services/trial-balance-export.service";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Download, RefreshCw, FileSpreadsheet, FileText, ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";

type ExportFormat = "pdf" | "excel";

export function TrialBalanceHeader() {
  const { items, reportContext, refresh, isLoading, error, urlError, hasPendingChanges } = useTrialBalance();
  const [exportingFormat, setExportingFormat] = useState<ExportFormat | null>(null);
  const [exportMessage, setExportMessage] = useState("");
  const [exportFailed, setExportFailed] = useState(false);
  const canExport = !!reportContext && items.length > 0 && !isLoading && !error && !urlError && !hasPendingChanges && !exportingFormat;

  const handleExport = async (format: ExportFormat) => {
    if (!canExport || !reportContext) return;
    setExportingFormat(format);
    setExportFailed(false);
    setExportMessage("Generating " + (format === "pdf" ? "PDF" : "Excel") + " report…");
    try {
      // Allow the busy state to paint before synchronous workbook generation begins.
      await new Promise<void>(resolve => window.requestAnimationFrame(() => resolve()));
      if (format === "pdf") {
        await exportTrialBalanceToPdf(items, reportContext);
      } else {
        exportTrialBalanceToExcel(items, reportContext);
      }
      const formatLabel = format === "pdf" ? "PDF" : "Excel";
      setExportMessage(formatLabel + " report generated.");
      toast.success(formatLabel + " report generated.");
    } catch (failure) {
      const formatLabel = format === "pdf" ? "PDF" : "Excel";
      const message = failure instanceof Error ? failure.message : formatLabel + " generation failed. Please try again.";
      setExportFailed(true);
      setExportMessage(formatLabel + " export failed: " + message);
      toast.error(formatLabel + " export failed: " + message);
    } finally {
      setExportingFormat(null);
    }
  };

  const exportHint = isLoading
    ? "Exports are paused while the report updates."
    : error || urlError
      ? "Exports are unavailable until the report loads successfully."
      : !reportContext
        ? "Load a report before exporting."
        : hasPendingChanges
          ? "Apply or clear pending filter changes before exporting."
          : "Includes all matching accounts across pages; the current table page and sort do not limit the export.";

  return (
    <div className="mb-6 flex flex-col gap-4 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Trial Balance Review Report</h1>
        <p className="text-muted-foreground">
          Review header details, validate debit and credit totals, and drill into underlying journal entries.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          variant="outline"
          className="gap-2"
          onClick={() => void refresh()}
          disabled={isLoading || !!urlError}
          aria-busy={isLoading}
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {isLoading ? "Refreshing report…" : "Regenerate Report"}
        </Button>

        <div className="flex flex-col items-end gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                disabled={!canExport}
                aria-busy={!!exportingFormat}
                aria-describedby="tb-export-scope"
                className="min-w-[230px] gap-2 bg-primary text-primary-foreground"
              >
                {exportingFormat ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {exportingFormat
                  ? "Generating " + (exportingFormat === "pdf" ? "PDF" : "Excel") + "…"
                  : "Export all filtered accounts"}
                <ChevronDown className="ml-1 h-3 w-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[220px] rounded-xl">
              <DropdownMenuItem
                className="cursor-pointer gap-2 py-2.5"
                onClick={() => void handleExport("pdf")}
                disabled={!canExport}
              >
                <FileText className="h-4 w-4 text-rose-500" />
                <span>Export to PDF</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer gap-2 py-2.5"
                onClick={() => void handleExport("excel")}
                disabled={!canExport}
              >
                <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
                <span>Export to Excel</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <p id="tb-export-scope" className="max-w-[22rem] text-right text-xs text-muted-foreground">
            {exportHint}
          </p>
          {exportMessage && (
            <p
              role={exportFailed ? "alert" : "status"}
              aria-live={exportFailed ? "assertive" : "polite"}
              className="max-w-[22rem] text-right text-xs text-muted-foreground"
            >
              {exportMessage}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
