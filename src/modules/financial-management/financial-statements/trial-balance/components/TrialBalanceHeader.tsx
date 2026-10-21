"use client";

import { useState } from "react";
import { useTrialBalance } from "../hooks/useTrialBalance";
import { 
  exportTrialBalanceToExcel, 
  exportTrialBalanceToPdf 
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

export function TrialBalanceHeader() {
  const { items, reportContext, refresh, isLoading, error, urlError } = useTrialBalance();
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const canExport = !!reportContext && items.length > 0 && !isLoading && !error && !urlError && !isExportingPdf;

  const handleExportExcel = () => {
    if (canExport && reportContext) exportTrialBalanceToExcel(items, reportContext);
  };

  const handleExportPdf = async () => {
    if (!canExport || !reportContext) return;
    setIsExportingPdf(true);
    try {
      await exportTrialBalanceToPdf(items, reportContext);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The PDF could not be generated. Please try again.");
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-4 mb-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Trial Balance Review Report</h1>
        <p className="text-muted-foreground">
          Review header details, validate debit and credit totals, and drill into underlying journal entries.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button 
          variant="outline" 
          className="gap-2"
          onClick={() => refresh()}
          disabled={isLoading || !!urlError}
        >
          <RefreshCw className="h-4 w-4" />
          Regenerate Report
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button disabled={!canExport} aria-busy={isExportingPdf} className="gap-2 bg-primary text-primary-foreground min-w-[120px]">
              {isExportingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {isExportingPdf ? "Generating PDF…" : "Export all filtered"}
              <ChevronDown className="h-3 w-3 ml-1 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[180px] rounded-xl">
            <DropdownMenuItem 
              className="gap-2 cursor-pointer py-2.5" 
              onClick={handleExportPdf}
              disabled={!canExport}
            >
              <FileText className="h-4 w-4 text-rose-500" />
              <span>Export to PDF</span>
            </DropdownMenuItem>
            <DropdownMenuItem 
              className="gap-2 cursor-pointer py-2.5" 
              onClick={handleExportExcel}
              disabled={!canExport}
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
              <span>Export to Excel</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
