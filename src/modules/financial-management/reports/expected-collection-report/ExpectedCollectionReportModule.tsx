"use client";

import { AlertCircle, FileText, Users } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Expected Collection Report</h1>
        <p className="text-sm text-muted-foreground">
          Review invoices due this week and expected collections by salesman.
        </p>
      </div>

      <ExpectedCollectionControls
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
        onStartDateChange={report.selectStartDate}
        onEndDateChange={report.selectEndDate}
        onClearFilters={report.clearFilters}
      />

      {report.error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Unable to load expected collections</AlertTitle>
          <AlertDescription>{report.error}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="invoices">
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
            records={report.filteredRecords}
            loading={report.loading}
            hasActiveFilters={report.hasActiveFilters}
          />
        </TabsContent>
        <TabsContent value="salesmen" className="mt-4">
          <SalesmanTab
            groups={report.salesmanGroups}
            loading={report.loading}
            hasActiveFilters={report.hasActiveFilters}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
