"use client";

import { ReportControlSection } from "./report-control-section";
import { SummaryCards } from "./summary-cards";
import { InteractiveStatementTable } from "./interactive-statement-table";
import { BalanceSheetProvider } from "../providers/BalanceSheetProvider";
import { useBalanceSheet } from "../hooks/useBalanceSheet";
import { Loader2 } from "lucide-react";

function StatementContent() {
    const { accounts, validation, ratios, isLoading, error } = useBalanceSheet();

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground font-medium">Loading financial statement...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
                <p className="text-sm text-destructive font-medium">Failed to load data</p>
                <p className="text-xs text-muted-foreground max-w-md text-center">{error}</p>
            </div>
        );
    }

    return (
        <>
            {/* Top Container: Header + Filters + Validation/Ratios */}
            <ReportControlSection validation={validation} ratios={ratios} />

            {/* Middle: Summary Cards */}
            <SummaryCards validation={validation} />

            {/* Bottom: Main Table */}
            <InteractiveStatementTable accounts={accounts} />
        </>
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
