"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Wallet, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface CashFlowSummaryProps {
  operatingActivities: number;
  investingActivities: number;
  financingActivities: number;
  netIncreaseInCash: number;
  uncategorizedCount: number;
  uncategorizedNetMovement: number;
  registerNetMovement: number;
  reconciliationDifference: number;
  isLoading?: boolean;
}

// ── Static Intl formatter (created once) ─────────────────────────
const currencyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function getDisplayedCashFlowValue(value: number) {
  return Math.round(Math.abs(value) * 100) === 0 ? 0 : value;
}

function formatCashFlowAmount(value: number) {
  return currencyFormatter.format(getDisplayedCashFlowValue(value));
}

// ── Skeleton card ────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <Card className="animate-pulse gap-2 py-3 sm:gap-6 sm:py-6">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 px-3 pb-1 sm:px-6">
        <CardTitle className="h-4 w-24 rounded bg-muted text-xs font-medium sm:text-sm" />
        <div className="h-4 w-4 bg-muted rounded" />
      </CardHeader>
      <CardContent className="px-3 sm:px-6">
        <div className="h-6 w-28 rounded bg-muted sm:h-8 sm:w-32" />
      </CardContent>
    </Card>
  );
}

// ── Single summary card (pure, memoized) ─────────────────────────
interface SummaryCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  borderColor: string;
  iconColor: string;
}
const SummaryCard = React.memo(function SummaryCard({
  title,
  value,
  icon,
  borderColor,
  iconColor,
}: SummaryCardProps) {
  const displayedValue = getDisplayedCashFlowValue(value);
  const label = displayedValue > 0
    ? "Net cash inflow"
    : displayedValue < 0
      ? "Net cash outflow"
      : "No net movement";
  const changeIcon = displayedValue > 0
    ? <TrendingUp className="h-4 w-4" />
    : displayedValue < 0
      ? <TrendingDown className="h-4 w-4" />
      : null;

  return (
    <Card className={cn("gap-2 border-l-4 py-3 sm:gap-6 sm:py-6", borderColor)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 px-3 pb-0 sm:px-6">
        <CardTitle className="min-w-0 text-xs font-medium leading-tight text-muted-foreground sm:text-sm">
          {title}
        </CardTitle>
        <div className={cn("shrink-0 [&_svg]:h-3.5 [&_svg]:w-3.5 sm:[&_svg]:h-4 sm:[&_svg]:w-4", iconColor)}>{icon}</div>
      </CardHeader>
      <CardContent className="min-w-0 px-3 sm:px-6">
        <div className="break-words text-[clamp(0.875rem,4vw,1.25rem)] font-bold leading-tight tabular-nums text-foreground sm:text-2xl">
          {formatCashFlowAmount(displayedValue)}
        </div>
        <div className="mt-1 flex items-center text-[10px] text-muted-foreground sm:text-xs">
          {changeIcon}
          <span className="ml-1">{label}</span>
        </div>
      </CardContent>
    </Card>
  );
});

// ── Main component ───────────────────────────────────────────────
export function CashFlowSummary(props: CashFlowSummaryProps) {
  const {
    operatingActivities,
    investingActivities,
    financingActivities,
    netIncreaseInCash,
    uncategorizedCount,
    uncategorizedNetMovement,
    registerNetMovement,
    reconciliationDifference,
    isLoading,
  } = props;

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <SummaryCard
          title="Operating Activities"
          value={operatingActivities}
          icon={<Wallet className="h-4 w-4" />}
          borderColor="border-l-emerald-500"
          iconColor="text-emerald-500"
        />
        <SummaryCard
          title="Investing Activities"
          value={investingActivities}
          icon={<ArrowUpRight className="h-4 w-4" />}
          borderColor="border-l-blue-500"
          iconColor="text-blue-500"
        />
        <SummaryCard
          title="Financing Activities"
          value={financingActivities}
          icon={<TrendingUp className="h-4 w-4" />}
          borderColor="border-l-amber-500"
          iconColor="text-amber-500"
        />
        <SummaryCard
          title="Net Change in Cash"
          value={netIncreaseInCash}
          icon={<Wallet className="h-4 w-4" />}
          borderColor="border-l-purple-500"
          iconColor="text-purple-500"
        />
      </div>

      <p className="text-xs text-muted-foreground">
        Inflow and outflow describe cash direction, not whether activity is favorable. An investing outflow may represent an asset purchase.
      </p>

      <div className={cn(
        "rounded-md border px-3 py-2 text-xs sm:px-4 sm:py-3 sm:text-sm",
        uncategorizedCount > 0
          ? "border-amber-500/30 bg-amber-50/60 dark:bg-amber-950/15"
          : "border-border bg-muted/30",
      )}>
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="font-semibold">Uncategorized transactions</p>
          <p className="tabular-nums">
            <strong>{uncategorizedCount}</strong> {uncategorizedCount === 1 ? "transaction" : "transactions"}
            <span className="mx-2 text-muted-foreground">·</span>
            <strong>{formatCashFlowAmount(uncategorizedNetMovement)}</strong> net movement
          </p>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground sm:text-xs">
          {uncategorizedCount > 0
            ? <>These transactions remain in the register but are not included in Net Change in Cash. All-register movement: <strong>{formatCashFlowAmount(registerNetMovement)}</strong>; register-to-report difference: <strong>{formatCashFlowAmount(reconciliationDifference)}</strong>.</>
            : <>All register transactions are classified. All-register movement: <strong>{formatCashFlowAmount(registerNetMovement)}</strong>; difference from reported activity total: <strong>{formatCashFlowAmount(reconciliationDifference)}</strong>.</>}
        </p>
      </div>
    </div>
  );
}
