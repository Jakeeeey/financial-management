"use client";

import { FinancialPerformanceProvider } from "../providers/financial-performance-provider";
import { ReportControlSection } from "./report-control-section";
import { SummaryCards } from "./summary-cards";
import { InteractiveStatementTable } from "./interactive-statement-table";

export function FinancialPerformanceClient() {
  return (
    <FinancialPerformanceProvider>
      <div className="space-y-6 animate-in fade-in duration-500 max-w-[1600px] mx-auto w-full">
        <ReportControlSection />
        <SummaryCards />
        <InteractiveStatementTable />
      </div>
    </FinancialPerformanceProvider>
  );
}
