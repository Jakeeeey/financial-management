"use client";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useTrialBalance } from "../hooks/useTrialBalance";
import { PERIOD_ACTIVITY_NOTE } from "../utils/money";

const reportDateFormatter = new Intl.DateTimeFormat("en-PH", {
  day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
});
const updatedAtFormatter = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium", timeStyle: "medium", timeZone: "Asia/Manila",
});

export function TrialBalanceReportContext() {
  const { reportContext, lastUpdatedAt, isLoading, error, urlError } = useTrialBalance();
  const isPosted = reportContext?.postedOnly || reportContext?.status.toLowerCase() === "posted";
  const scopeLabel = isPosted ? "Posted transactions" : reportContext?.status === "all" ? "All statuses" : `${reportContext?.status} transactions`;
  const lastUpdatedLabel = lastUpdatedAt ? `${updatedAtFormatter.format(lastUpdatedAt)} PHT` : null;

  return (
    <section aria-label="Report context" aria-busy={isLoading} className="mb-4 rounded-lg border bg-muted/20 px-4 py-3">
      {reportContext ? (
        <>
          <dl className="flex flex-wrap items-center gap-x-8 gap-y-3 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Reporting period</dt>
              <dd className="mt-1 font-medium">
                <time dateTime={reportContext.startDate}>{reportDateFormatter.format(new Date(`${reportContext.startDate}T00:00:00Z`))}</time>
                {" – "}
                <time dateTime={reportContext.endDate}>{reportDateFormatter.format(new Date(`${reportContext.endDate}T00:00:00Z`))}</time>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Transaction scope</dt>
              <dd className="mt-1 flex flex-wrap items-center gap-2 font-medium">
                {scopeLabel}
                {!isPosted && <Badge variant="outline" className="border-amber-500/50 text-amber-700 dark:text-amber-400">Provisional</Badge>}
              </dd>
            </div>
            {lastUpdatedAt && (
              <div>
                <dt className="text-xs text-muted-foreground">Last updated</dt>
                <dd className="mt-1 font-medium">
                  <time dateTime={lastUpdatedAt.toISOString()}>{lastUpdatedLabel}</time>
                </dd>
              </div>
            )}
          </dl>
          <p className="mt-2 text-xs text-muted-foreground">{PERIOD_ACTIVITY_NOTE}</p>
          {!isPosted && (
            <p className="mt-2 text-xs text-muted-foreground">
              {reportContext.status === "all" ? "Includes posted and unposted transactions." : "Includes unposted transactions only."}
            </p>
          )}
        </>
      ) : isLoading ? (
        <div className="flex flex-wrap gap-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-40" />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Report context is unavailable until a report loads successfully.</p>
      )}
      <p role="status" aria-live="polite" className="mt-1 text-xs text-muted-foreground">
        {isLoading
          ? reportContext ? "Updating report… Showing the last loaded report." : <span className="sr-only">Loading report context…</span>
          : error && reportContext
            ? `Refresh failed. Showing the last successful report${lastUpdatedLabel ? `, last updated ${lastUpdatedLabel}` : ""}.`
            : reportContext && lastUpdatedLabel
              ? `Report loaded. Last updated ${lastUpdatedLabel}.`
              : urlError ? "Report filters could not be applied." : null}
      </p>
    </section>
  );
}
