"use client";

import React from "react";
import { BUDGET_REPORTS } from "./constants";
import { ReportCard } from "./components/ReportCard";
import { FileChartColumn } from "lucide-react";
import { useBudgetReports, MONTH_NAMES } from "./hooks/useBudgetReports";
import { ReportPreviewModal } from "./components/ReportPreviewModal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function BudgetReportsModule() {
  const {
    filters,
    updateFilter,
    divisions,
    templates,
    loading,
    pdfUrl,
    activeReportId,
    previewReport,
    downloadReport,
    exportToExcel,
    closePreview
  } = useBudgetReports();

  const activeReport = BUDGET_REPORTS.find(r => r.id === activeReportId);

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 min-h-0 min-w-0 flex-1">
      {/* Header Section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 rounded-2xl">
            <FileChartColumn className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tighter uppercase leading-none">
              Budget Reports
            </h1>
            <p className="text-sm text-muted-foreground mt-1 font-medium">
              Generate and export financial insights and analytical data for budgeting.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-muted/30 p-1.5 rounded-2xl border border-border/40 shrink-0">
          <Select 
            value={filters.division_id || "all"} 
            onValueChange={(val) => updateFilter("division_id", val === "all" ? "" : val)}
          >
            <SelectTrigger className="h-9 w-40 rounded-xl text-[10px] font-black uppercase tracking-widest border-none bg-transparent hover:bg-white transition-colors">
              <SelectValue placeholder="Division" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all" className="text-[10px] font-bold uppercase">All Divisions</SelectItem>
              {divisions.map(d => (
                <SelectItem key={d.id} value={d.id} className="text-[10px] font-bold uppercase">
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="h-4 w-px bg-border/60" />
          <Select 
            value={filters.month} 
            onValueChange={(val) => updateFilter("month", val)}
          >
            <SelectTrigger className="h-9 w-32 rounded-xl text-[10px] font-black uppercase tracking-widest border-none bg-transparent hover:bg-white transition-colors">
              <SelectValue placeholder="Month" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {MONTH_NAMES.map((name, i) => (
                <SelectItem key={name} value={String(i + 1)} className="text-[10px] font-bold uppercase">
                  {name} {filters.year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Reports Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {BUDGET_REPORTS.map((report) => (
          <ReportCard 
            key={report.id} 
            report={report} 
            templates={templates}
            onPreview={previewReport}
            onDownload={downloadReport}
            onExcel={exportToExcel}
          />
        ))}
      </div>

      {/* Report Preview Modal */}
      <ReportPreviewModal 
        isOpen={!!activeReportId}
        onClose={closePreview}
        title={activeReport?.title || ""}
        pdfUrl={pdfUrl}
        loading={loading}
      />
    </div>
  );
}


