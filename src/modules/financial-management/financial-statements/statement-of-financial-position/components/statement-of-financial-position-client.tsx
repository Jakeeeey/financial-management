"use client";

import { ReportControlSection } from "./report-control-section";
import { SummaryCards } from "./summary-cards";
import { InteractiveStatementTable } from "./interactive-statement-table";
import { BalanceSheetMoreAnalytics } from "./more-analytics";
import { BalanceSheetProvider } from "../providers/BalanceSheetProvider";
import { useBalanceSheet } from "../hooks/useBalanceSheet";
import { Button } from "@/components/ui/button";

const lastUpdatedFormatter = new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
});

function StatementContent() {
    const { validation, ratios, summary, error, reportStatus, lastUpdated, appliedFilters, accounts, comparisonStatus, isLoading, refresh } = useBalanceSheet();
    const hasSuccessfulReport = appliedFilters !== null;
    const hasAccountRows = accounts.length > 0;
    const lastUpdatedText = lastUpdated ? `${lastUpdatedFormatter.format(lastUpdated)} PHT` : null;

    return (
        <div className="flex min-w-0 flex-col gap-3 sm:gap-4 animate-in fade-in duration-500">
            <ReportControlSection />

            {reportStatus === "not-generated" && (
                <div role="status" className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground">Not generated.</span> Select report criteria and choose Generate report to view balances.
                </div>
            )}

            {reportStatus === "loading-initial" && (
                <p role="status" aria-live="polite" aria-busy="true" className="text-sm text-muted-foreground">
                    Generating report…
                </p>
            )}

            {(reportStatus === "initial-error" || reportStatus === "refresh-error") && (
                <div role="alert" className="flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                        <p className="font-semibold text-destructive">
                            {reportStatus === "refresh-error" ? "Refresh failed" : "Unable to generate report"}
                        </p>
                        <p className="mt-1 break-words text-sm text-muted-foreground">{error || "The report could not be loaded."}</p>
                        {reportStatus === "refresh-error" && (
                            <p className="mt-1 text-sm text-muted-foreground">
                                The last successful report remains visible{lastUpdatedText ? `; last updated ${lastUpdatedText}` : ""}. Retry to load the latest report for the selected criteria.
                            </p>
                        )}
                    </div>
                    <Button type="button" variant="outline" onClick={() => void refresh()} disabled={isLoading} className="shrink-0">
                        {isLoading ? "Retrying…" : "Retry"}
                    </Button>
                </div>
            )}

            {reportStatus === "refreshing" && (
                <p role="status" aria-live="polite" aria-busy="true" className="text-sm text-muted-foreground">
                    Refreshing report. The last successful results remain visible{lastUpdatedText ? `; last updated ${lastUpdatedText}` : ""}.
                </p>
            )}

            {reportStatus === "success" && lastUpdatedText && (
                <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
                    Report updated. Last updated {lastUpdatedText}.
                </p>
            )}

            {hasSuccessfulReport && !hasAccountRows && (
                <p role="status" aria-live="polite" className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                    No account balances were returned for the applied criteria{lastUpdatedText ? `. Last updated ${lastUpdatedText}.` : "."}
                </p>
            )}

            <SummaryCards validation={validation} />

            {(hasSuccessfulReport || reportStatus === "loading-initial") && <InteractiveStatementTable />}

            {hasSuccessfulReport && hasAccountRows && summary !== null && (
                <BalanceSheetMoreAnalytics validation={validation} ratios={ratios} comparisonStatus={comparisonStatus} />
            )}
        </div>
    );
}

export function StatementOfFinancialPositionClient() {
    return (
        <BalanceSheetProvider>
            <div className="flex min-w-0 flex-col gap-4 w-full max-w-[1600px] mx-auto pb-10">
                <StatementContent />
            </div>
        </BalanceSheetProvider>
    );
}
