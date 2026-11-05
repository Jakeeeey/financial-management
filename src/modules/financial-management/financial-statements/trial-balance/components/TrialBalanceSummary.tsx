"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, CheckCircle2, Info, ListFilter } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatTrialBalanceAmount } from "../utils/money";
import { TrialBalanceSummaryData } from "../types/trial-balance.schema";
import { getTrialBalanceDifferenceMessage } from "../utils/summary";

interface SummaryCardProps {
  label: string;
  value: string | number;
  subLabel?: string;
  type?: "default" | "error" | "info" | "success";
  icon?: React.ReactNode;
  monetary?: boolean;
}

function SummaryCard({ label, value, subLabel, type = "default", icon, monetary = false }: SummaryCardProps) {
  return (
    <Card className={cn(
      "border-l-4 overflow-hidden",
      type === "default" && "border-l-primary/20",
      type === "error" && "border-l-destructive bg-destructive/5",
      type === "info" && "border-l-blue-500",
      type === "success" && "border-l-green-500"
    )}>
      <CardContent className="p-4 flex items-center justify-between">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <div className={cn("flex items-baseline gap-2", monetary && "justify-end text-right")}>
            <h2 className={cn(
              "text-2xl font-bold tracking-tight break-words min-w-0",
              monetary && "tabular-nums",
              type === "error" && "text-destructive"
            )}>
              {value}
            </h2>
          </div>
          {subLabel && <p className="text-xs text-muted-foreground">{subLabel}</p>}
        </div>
        {icon && <div className="ml-2 shrink-0 text-muted-foreground/20">{icon}</div>}
      </CardContent>
    </Card>
  );
}

export function TrialBalanceSummary({ summary, isLoading = false }: { summary?: TrialBalanceSummaryData; isLoading?: boolean }) {
  if (isLoading || !summary) {
    return (
      <section aria-label="Trial balance totals" aria-busy="true" className="mb-6 space-y-3">
        <p role="status" aria-live="polite" className="sr-only">Loading trial balance totals.</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Card key={index}>
              <CardContent className="space-y-3 p-4">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-7 w-40" />
                <Skeleton className="h-3 w-28" />
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    );
  }

  const canReconcile = summary.scope === "report" && summary.accountCount > 0;

  return (
    <section aria-label="Trial balance totals" className="mb-6 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          label="Period debit activity"
          value={formatTrialBalanceAmount(summary.totalDebit)}
          monetary
          icon={<ListFilter className="h-8 w-8" />}
        />
        <SummaryCard
          label="Period credit activity"
          value={formatTrialBalanceAmount(summary.totalCredit)}
          monetary
        />
        <SummaryCard
          label="Filtered debit–credit difference"
          value={formatTrialBalanceAmount(summary.difference)}
          monetary
          type={!canReconcile ? "default" : summary.isBalanced ? "success" : "error"}
          subLabel={summary.accountCount === 0 ? "No accounts to reconcile" : getTrialBalanceDifferenceMessage(summary.difference)}
          icon={!canReconcile ? <Info className="h-8 w-8" /> : summary.isBalanced ? <CheckCircle2 className="h-8 w-8 text-green-500" /> : <AlertCircle className="h-8 w-8 text-destructive" />}
        />
        <SummaryCard
          label="Accounts"
          value={summary.accountCount}
          subLabel="Unique accounts found"
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {summary.scope === "filtered"
          ? "This difference applies to the filtered results and does not establish a full-report imbalance."
          : "Totals cover the complete report for the reporting period and transaction scope shown above."}
      </p>
    </section>
  );
}
