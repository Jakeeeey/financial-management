"use client";

import type { ReactNode } from "react";
import { AlertCircle, ClipboardList, DollarSign } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LogisticsWerDetailsSheet } from "./components/LogisticsWerDetailsSheet";
import { LogisticsWerFilters } from "./components/LogisticsWerFilters";
import { LogisticsWerTable } from "./components/LogisticsWerTable";
import { useLogisticsWer, LOGISTICS_WER_STATUS_OPTIONS } from "./hooks/useLogisticsWer";
import { formatDateRange } from "./utils/date";

function formatMoney(value: number): string {
  return `₱${value.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function LogisticsWerModule() {
  const report = useLogisticsWer();
  const rows = report.report?.content ?? [];
  const pageCount = report.report?.totalPages ?? 0;
  const currentPage = report.report ? report.report.number + 1 : report.page + 1;
  const visiblePlannedAmount = rows.reduce((total, row) => total + row.amount, 0);

  return (
    <div className="flex min-h-0 min-w-0 w-full max-w-full flex-1 flex-col gap-5">
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Logistics WER</h1>
          <p className="text-sm text-muted-foreground">
            Review dispatch plans and the expense lines recorded for each plan.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ClipboardList className="size-4" />
          {report.report ? formatDateRange(report.report.range) : "Loading range…"}
        </div>
      </div>

      <LogisticsWerFilters
        draftRange={report.draftRange}
        draftSearch={report.draftSearch}
        status={report.status}
        statusOptions={LOGISTICS_WER_STATUS_OPTIONS}
        onRangeChange={report.setDraftRange}
        onSearchChange={report.setDraftSearch}
        onStatusChange={report.changeStatus}
        onApply={report.applyFilters}
        onPreviousWeek={() => report.navigateWeek(-1)}
        onNextWeek={() => report.navigateWeek(1)}
        onCurrentWeek={report.resetToCurrentWeek}
      />

      {report.error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Unable to load Logistics WER</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-3">
            <span>{report.error}</span>
            <Button type="button" variant="outline" size="sm" onClick={() => void report.retry()} disabled={report.loading}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <SummaryCard
          title="Dispatch plans"
          value={String(report.report?.totalElements ?? 0)}
          icon={<ClipboardList className="size-4" />}
          note="Plans in selected range"
        />
        <SummaryCard
          title="Planned amount"
          value={formatMoney(visiblePlannedAmount)}
          icon={<DollarSign className="size-4" />}
          note="Current page"
        />
      </div>

      <LogisticsWerTable rows={rows} loading={report.loading} onViewDetails={report.openDetails} />

      <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <span>{report.report ? `Page ${currentPage} of ${Math.max(pageCount, 1)}` : "Loading…"}</span>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => report.setPage(Math.max(0, report.page - 1))} disabled={report.page === 0 || report.loading}>
            Previous
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => report.setPage(report.page + 1)} disabled={!report.report || report.page + 1 >= pageCount || report.loading}>
            Next
          </Button>
        </div>
      </div>

      <LogisticsWerDetailsSheet
        detail={report.detail}
        loading={report.detailLoading}
        error={report.detailError}
        onOpenChange={(open) => {
          if (!open) report.closeDetails();
        }}
        onChanged={() => {
          void report.refreshDetails();
        }}
      />
    </div>
  );
}

function SummaryCard({ title, value, note, icon }: { title: string; value: string; note: string; icon: ReactNode }) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground">{title}</CardTitle>
        <span className="text-primary">{icon}</span>
      </CardHeader>
      <CardContent>
        <p className="text-xl font-semibold tracking-tight">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{note}</p>
      </CardContent>
    </Card>
  );
}
