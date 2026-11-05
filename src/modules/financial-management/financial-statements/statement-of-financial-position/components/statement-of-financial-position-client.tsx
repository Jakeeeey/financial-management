"use client";

import { ReportControlSection } from "./report-control-section";
import { SummaryCards } from "./summary-cards";
import { InteractiveStatementTable } from "./interactive-statement-table";
import { BalanceSheetStatementView } from "./BalanceSheetStatementView";
import { BalanceSheetMoreAnalytics } from "./more-analytics";
import { BalanceSheetProvider } from "../providers/BalanceSheetProvider";
import { useBalanceSheet } from "../hooks/useBalanceSheet";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const lastUpdatedFormatter = new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
});

const reportDateFormatter = new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeZone: "UTC",
});

function formatReportDate(value: string) {
    return reportDateFormatter.format(new Date(`${value}T00:00:00Z`));
}

function StatementContent() {
    const { validation, ratios, summary, error, reportStatus, lastUpdated, appliedFilters, accounts, comparisonStatus, isLoading, refresh } = useBalanceSheet();
    const hasSuccessfulReport = appliedFilters !== null;
    const hasAccountRows = accounts.length > 0;
    const lastUpdatedText = lastUpdated ? `${lastUpdatedFormatter.format(lastUpdated)} PHT` : null;
    const appliedStatus = appliedFilters?.status.trim() ?? "";
    const statusIsPosted = appliedStatus.toLowerCase() === "posted";
    const statusLabel = !appliedStatus || appliedStatus.toLowerCase() === "all" ? "All statuses" : appliedStatus;

    return (
        <div className="flex min-w-0 flex-col gap-3 sm:gap-4 animate-in fade-in duration-500">
            <ReportControlSection />

            {appliedFilters && (
                <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm" aria-label="Applied report coverage">
                    <span className="font-semibold text-foreground">Report coverage</span>
                    <span className="text-muted-foreground">As of {formatReportDate(appliedFilters.endDate)}</span>
                    <span className="text-muted-foreground">Status: {statusIsPosted ? "Posted ledger activity" : statusLabel}</span>
                    <span className="text-muted-foreground">Division: {appliedFilters.divisionName || "All divisions"}</span>
                    <span className="text-muted-foreground">Department: {appliedFilters.departmentName || "All departments"}</span>
                    {statusIsPosted && (
                        <span className="basis-full text-xs text-muted-foreground">
                            Includes Sales Invoice entries recorded with Dispatched status.
                        </span>
                    )}
                    {!statusIsPosted && (
                        <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-300">
                            Provisional — may include unposted activity
                        </span>
                    )}
                </div>
            )}

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

            {(hasSuccessfulReport || reportStatus === "loading-initial") && (
                <Tabs defaultValue="statement" className="min-w-0 gap-3">
                    <TabsList aria-label="Balance sheet views" className="w-full justify-start sm:w-fit">
                        <TabsTrigger value="statement">Statement</TabsTrigger>
                        <TabsTrigger value="account-breakdown">Account breakdown</TabsTrigger>
                    </TabsList>
                    <TabsContent value="statement" className="m-0 min-w-0">
                        <BalanceSheetStatementView />
                    </TabsContent>
                    <TabsContent value="account-breakdown" className="m-0 min-w-0">
                        <InteractiveStatementTable />
                    </TabsContent>
                </Tabs>
            )}

            {hasSuccessfulReport && hasAccountRows && summary !== null && (
                <BalanceSheetMoreAnalytics ratios={ratios} comparisonStatus={comparisonStatus} />
            )}
        </div>
    );
}

export function StatementOfFinancialPositionClient({ initialAsOfDate }: { initialAsOfDate: string }) {
    return (
        <BalanceSheetProvider initialAsOfDate={initialAsOfDate}>
            <div className="flex min-w-0 flex-col gap-4 w-full max-w-[1600px] mx-auto pb-10">
                <StatementContent />
            </div>
        </BalanceSheetProvider>
    );
}
