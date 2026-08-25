"use client";

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
import { Download, RefreshCw, FileSpreadsheet, FileText, ChevronDown } from "lucide-react";

export function TrialBalanceHeader() {
  const { items, filters, refresh } = useTrialBalance();

  const handleExportExcel = () => {
    exportTrialBalanceToExcel(items, filters.startDate, filters.endDate);
  };

  const handleExportPdf = () => {
    exportTrialBalanceToPdf(items, filters.startDate, filters.endDate);
  };

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-4 mb-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Trial Balance Review Report</h1>
        <p className="text-muted-foreground">
          Review header details, validate debit and credit totals, and drill into underlying journal entries.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button 
          variant="outline" 
          className="gap-2"
          onClick={() => refresh()}
        >
          <RefreshCw className="h-4 w-4" />
          Regenerate Report
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="gap-2 bg-primary text-primary-foreground min-w-[120px]">
              <Download className="h-4 w-4" />
              Export
              <ChevronDown className="h-3 w-3 ml-1 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[180px] rounded-xl">
            <DropdownMenuItem 
              className="gap-2 cursor-pointer py-2.5" 
              onClick={handleExportPdf}
              disabled={items.length === 0}
            >
              <FileText className="h-4 w-4 text-rose-500" />
              <span>Export to PDF</span>
            </DropdownMenuItem>
            <DropdownMenuItem 
              className="gap-2 cursor-pointer py-2.5" 
              onClick={handleExportExcel}
              disabled={items.length === 0}
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
