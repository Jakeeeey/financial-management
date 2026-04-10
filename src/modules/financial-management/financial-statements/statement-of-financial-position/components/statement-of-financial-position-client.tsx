"use client";

import { useMemo } from "react";
import { ReportControlSection } from "./report-control-section";
import { SummaryCards } from "./summary-cards";
import { InteractiveStatementTable } from "./interactive-statement-table";
import { MOCK_ACCOUNTS, MOCK_VALIDATION, MOCK_RATIOS } from "../mock-data";

export function StatementOfFinancialPositionClient() {
    // In a real implementation, state and fetching logic would go here.
    // We are currently using mock data directly for the UI build phase.
    
    const accounts = useMemo(() => MOCK_ACCOUNTS, []);
    const validation = useMemo(() => MOCK_VALIDATION, []);
    const ratios = useMemo(() => MOCK_RATIOS, []);

    return (
        <div className="flex flex-col gap-6 w-full max-w-[1600px] mx-auto pb-10">
            {/* Top Container: Header + Filters + Validation/Ratios */}
            <ReportControlSection validation={validation} ratios={ratios} />

            {/* Middle: Summary Cards */}
            <SummaryCards validation={validation} />

            {/* Bottom: Main Table */}
            <InteractiveStatementTable accounts={accounts} />
        </div>
    );
}
