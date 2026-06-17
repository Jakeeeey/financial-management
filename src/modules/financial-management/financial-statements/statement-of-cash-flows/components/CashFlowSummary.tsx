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
  isLoading?: boolean;
}

// ── Static Intl formatter (created once) ─────────────────────────
const currencyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function getChangeColor(value: number) {
  if (value > 0) return "text-emerald-600 dark:text-emerald-400";
  if (value < 0) return "text-rose-600 dark:text-rose-400";
  return "text-muted-foreground";
}

// ── Skeleton card ────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <Card className="animate-pulse">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium h-4 w-24 bg-muted rounded" />
        <div className="h-4 w-4 bg-muted rounded" />
      </CardHeader>
      <CardContent>
        <div className="h-8 w-32 bg-muted rounded" />
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
  positiveLabel: string;
  negativeLabel: string;
  positiveIcon: React.ReactNode;
  negativeIcon: React.ReactNode;
}
const SummaryCard = React.memo(function SummaryCard({
  title,
  value,
  icon,
  borderColor,
  iconColor,
  positiveLabel,
  negativeLabel,
  positiveIcon,
  negativeIcon,
}: SummaryCardProps) {
  const color = getChangeColor(value);
  const label = value >= 0 ? positiveLabel : negativeLabel;
  const changeIcon = value > 0 ? positiveIcon : value < 0 ? negativeIcon : null;

  return (
    <Card className={cn("border-l-4", borderColor)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className={iconColor}>{icon}</div>
      </CardHeader>
      <CardContent>
        <div className={cn("text-2xl font-bold tabular-nums", color)}>
          {currencyFormatter.format(value)}
        </div>
        <div className="flex items-center text-xs text-muted-foreground mt-1">
          {changeIcon}
          <span className="ml-1">{label}</span>
        </div>
      </CardContent>
    </Card>
  );
});

// ── Main component ───────────────────────────────────────────────
export function CashFlowSummary(props: CashFlowSummaryProps) {
  const { operatingActivities, investingActivities, financingActivities, netIncreaseInCash, isLoading } = props;

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <SummaryCard
        title="Operating Activities"
        value={operatingActivities}
        icon={<Wallet className="h-4 w-4" />}
        borderColor="border-l-emerald-500"
        iconColor="text-emerald-500"
        positiveLabel="Positive cash flow"
        negativeLabel="Negative cash flow"
        positiveIcon={<TrendingUp className="h-4 w-4" />}
        negativeIcon={<TrendingDown className="h-4 w-4" />}
      />
      <SummaryCard
        title="Investing Activities"
        value={investingActivities}
        icon={<ArrowUpRight className="h-4 w-4" />}
        borderColor="border-l-blue-500"
        iconColor="text-blue-500"
        positiveLabel="Positive cash flow"
        negativeLabel="Negative cash flow"
        positiveIcon={<TrendingUp className="h-4 w-4" />}
        negativeIcon={<TrendingDown className="h-4 w-4" />}
      />
      <SummaryCard
        title="Financing Activities"
        value={financingActivities}
        icon={<TrendingUp className="h-4 w-4" />}
        borderColor="border-l-amber-500"
        iconColor="text-amber-500"
        positiveLabel="Positive cash flow"
        negativeLabel="Negative cash flow"
        positiveIcon={<TrendingUp className="h-4 w-4" />}
        negativeIcon={<TrendingDown className="h-4 w-4" />}
      />
      <SummaryCard
        title="Net Change in Cash"
        value={netIncreaseInCash}
        icon={<Wallet className="h-4 w-4" />}
        borderColor="border-l-purple-500"
        iconColor="text-purple-500"
        positiveLabel="Increase in cash"
        negativeLabel="Decrease in cash"
        positiveIcon={<TrendingUp className="h-4 w-4" />}
        negativeIcon={<TrendingDown className="h-4 w-4" />}
      />
    </div>
  );
}
