"use client";

import { AlertCircle, FileText, Users } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExpectedCollectionControls } from "./components/ExpectedCollectionControls";
import { InvoicesTab } from "./components/InvoicesTab";
import { SalesmanTab } from "./components/SalesmanTab";
import { useExpectedCollectionReport } from "./hooks/useExpectedCollectionReport";
import { currentManilaWeek } from "./utils/date";

export default function ExpectedCollectionReportModule() {
  const report = useExpectedCollectionReport();
  const fallbackRange = report.range || currentManilaWeek();

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
        showAllInvoices={report.showAllInvoices}
        filters={report.filters}
        filterOptions={report.filterOptions}
        loading={report.loading}
        hasActiveFilters={report.hasActiveFilters}
        onFiltersChange={report.setFilters}
        onPreviousWeek={report.previousWeek}
        onNextWeek={report.nextWeek}
        onCurrentWeek={report.resetToCurrentWeek}
        onShowAllInvoicesChange={report.toggleAllInvoices}
        onDateChange={report.selectDate}
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
            allInvoices={report.showAllInvoices}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
