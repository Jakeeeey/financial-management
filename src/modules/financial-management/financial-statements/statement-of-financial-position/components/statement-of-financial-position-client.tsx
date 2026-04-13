"use client";

import { ReportControlSection } from "./report-control-section";
import { SummaryCards } from "./summary-cards";
import { InteractiveStatementTable } from "./interactive-statement-table";
import { BalanceSheetProvider } from "../providers/BalanceSheetProvider";
import { useBalanceSheet } from "../hooks/useBalanceSheet";
import { Loader2 } from "lucide-react";

function StatementContent() {
    const { validation, ratios, error } = useBalanceSheet();

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
                <p className="text-sm text-destructive font-medium">Failed to load data</p>
                <p className="text-xs text-muted-foreground max-w-md text-center">{error}</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6 animate-in fade-in duration-500">
            {/* Top Container: Header + Filters + Validation/Ratios */}
            <ReportControlSection validation={validation} ratios={ratios} />

            {/* Middle: Summary Cards */}
            <SummaryCards validation={validation} />

            {/* Bottom: Main Table */}
            <InteractiveStatementTable />
        </div>
    );
}

export function StatementOfFinancialPositionClient() {
    return (
        <BalanceSheetProvider>
            <div className="flex flex-col gap-6 w-full max-w-[1600px] mx-auto pb-10">
                <StatementContent />
            </div>
        </BalanceSheetProvider>
    );
}
