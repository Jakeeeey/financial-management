"use client";

import { FinancialPerformanceProvider } from "../providers/financial-performance-provider";
import { ReportControlSection } from "./report-control-section";
import { SummaryCards } from "./summary-cards";
import { MoreAnalytics } from "./more-analytics";
import { InteractiveStatementTable } from "./interactive-statement-table";

export function FinancialPerformanceClient() {
  return (
    <FinancialPerformanceProvider>
      <div className="mx-auto w-full min-w-0 max-w-[1600px] space-y-4 animate-in fade-in duration-500">
        <ReportControlSection />
        <SummaryCards />
        <MoreAnalytics />
        <InteractiveStatementTable />
      </div>
    </FinancialPerformanceProvider>
  );
}
