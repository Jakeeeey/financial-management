"use client";

import React from "react";
import { BUDGET_REPORTS } from "./constants";
import { ReportCard } from "./components/ReportCard";
import { FileChartColumn } from "lucide-react";
import {
  useBudgetReports,
  MONTH_NAMES,
  PERIOD_TYPE_OPTIONS,
  QUARTER_OPTIONS,
  ReportPeriodType,
} from "./hooks/useBudgetReports";
import { HISTORY_YEARS } from "../budget-history/constants";
import { ReportPreviewModal } from "./components/ReportPreviewModal";
import { SearchableSelect } from "@/components/ui/searchable-select";

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
  const divisionOptions = React.useMemo(
    () => [
      { value: "all", label: "All Divisions" },
      ...divisions.map((division) => ({ value: division.id, label: division.name })),
    ],
    [divisions]
  );
  const monthOptions = React.useMemo(
    () => MONTH_NAMES.map((name, i) => ({ value: String(i + 1), label: name })),
    []
  );
  const quarterOptions = React.useMemo(
    () => QUARTER_OPTIONS.map((quarter) => ({ value: quarter.value, label: quarter.label })),
    []
  );
  const yearOptions = React.useMemo(
    () => HISTORY_YEARS.map((year) => ({ value: year.toString(), label: year.toString() })),
    []
  );
  const filterSelectClassName = "h-9 rounded-xl text-[10px] font-black uppercase tracking-widest border-none bg-transparent hover:bg-white transition-colors shadow-none";

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
          <SearchableSelect
            options={divisionOptions}
            value={filters.division_id || "all"}
            onValueChange={(val) => updateFilter("division_id", val === "all" ? "" : val)}
            placeholder="Division"
            className={`w-40 ${filterSelectClassName}`}
          />
          <div className="h-4 w-px bg-border/60" />
          <SearchableSelect
            options={PERIOD_TYPE_OPTIONS}
            value={filters.periodType}
            onValueChange={(val) => updateFilter("periodType", val as ReportPeriodType)}
            placeholder="Period Type"
            className={`w-32 ${filterSelectClassName}`}
          />
          {filters.periodType !== "yearly" && <div className="h-4 w-px bg-border/60" />}
          {filters.periodType === "monthly" && (
            <SearchableSelect
              options={monthOptions}
              value={filters.month}
              onValueChange={(val) => updateFilter("month", val)}
              placeholder="Month"
              className={`w-32 ${filterSelectClassName}`}
            />
          )}
          {filters.periodType === "quarterly" && (
            <SearchableSelect
              options={quarterOptions}
              value={filters.quarter}
              onValueChange={(val) => updateFilter("quarter", val)}
              placeholder="Quarter"
              className={`w-36 ${filterSelectClassName}`}
            />
          )}
          <div className="h-4 w-px bg-border/60" />
          <SearchableSelect
            options={yearOptions}
            value={filters.year}
            onValueChange={(val) => updateFilter("year", val)}
            placeholder="Year"
            className={`w-24 ${filterSelectClassName}`}
          />
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


