"use client";

import { AlertCircle, FileText, Users } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExpectedCollectionControls } from "./components/ExpectedCollectionControls";
import { InvoicesTab } from "./components/InvoicesTab";
import { SalesmanTab } from "./components/SalesmanTab";
import { useExpectedCollectionReport } from "./hooks/useExpectedCollectionReport";
import { currentManilaWeek, dateRangeForPeriod } from "./utils/date";

export default function ExpectedCollectionReportModule() {
  const report = useExpectedCollectionReport();
  const fallbackRange = report.range
    || dateRangeForPeriod(report.period, report.referenceDate)
    || currentManilaWeek();
  const resultKey = [
    report.resultVersion,
    report.filters.division,
    report.filters.salesman,
    report.filters.customerName,
    report.filters.invoiceNo,
  ].join("|");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Expected Collection Report</h1>
        <p className="text-sm text-muted-foreground">
          Review due invoices and prioritize expected collections by salesman.
        </p>
      </div>

      <ExpectedCollectionControls
        key={`${fallbackRange.startDate}-${fallbackRange.endDate}`}
        range={fallbackRange}
        period={report.period}
        filters={report.filters}
        filterOptions={report.filterOptions}
        loading={report.loading}
        hasActiveFilters={report.hasActiveFilters}
        onFiltersChange={report.setFilters}
        onPreviousPeriod={report.previousPeriod}
        onNextPeriod={report.nextPeriod}
        onCurrentPeriod={report.resetToCurrentPeriod}
        onPeriodChange={report.selectPeriod}
        onApplyCustomRange={report.applyCustomRange}
        onClearFilters={report.clearFilters}
      />

      {report.error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Unable to load expected collections</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>{report.error}</p>
            {report.range && <p>The previous successful range remains displayed below.</p>}
            <Button type="button" variant="outline" size="sm" onClick={report.retry} disabled={report.loading}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {report.refreshing && (
        <p className="text-sm text-muted-foreground" role="status">
          Refreshing the report. Results from the previous successful range remain visible.
        </p>
      )}

      <div className="sr-only" role="status" aria-live="polite">
        {report.loading
          ? report.refreshing ? "Refreshing expected collections." : "Loading expected collections."
          : `Loaded ${report.filteredRecords.length} expected collection records.`}
      </div>

      {(report.initialLoading || report.range) && <Tabs defaultValue="invoices">
        <TabsList aria-label="Expected collection report views">
          <TabsTrigger value="invoices">
            <FileText className="size-4" />
            Invoices
          </TabsTrigger>
          <TabsTrigger value="salesmen">
            <Users className="size-4" />
            By Salesman
          </TabsTrigger>
        </TabsList>

        <TabsContent value="invoices" className="mt-4">
          <InvoicesTab
            key={`invoices-${resultKey}`}
            records={report.filteredRecords}
            loading={report.initialLoading}
            hasActiveFilters={report.hasActiveFilters}
            range={fallbackRange}
            invoiceQuery={report.filters.invoiceNo}
            customerQuery={report.filters.customerName}
            onClearFilters={report.clearFilters}
          />
        </TabsContent>
        <TabsContent value="salesmen" className="mt-4">
          <SalesmanTab
            key={`salesmen-${resultKey}`}
            groups={report.salesmanGroups}
            loading={report.initialLoading}
            hasActiveFilters={report.hasActiveFilters}
            range={fallbackRange}
            invoiceQuery={report.filters.invoiceNo}
            customerQuery={report.filters.customerName}
            onClearFilters={report.clearFilters}
          />
        </TabsContent>
      </Tabs>}
    </div>
  );
}
