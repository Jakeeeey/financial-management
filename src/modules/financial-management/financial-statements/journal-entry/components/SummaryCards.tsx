"use client";

import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  FileText,
  LogOut,
  Scale,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { AnalyticsSummary } from "../types";
import { formatJournalAmount } from "../utils/formatters";

interface SummaryCardsProps {
  data: AnalyticsSummary;
  loading?: boolean;
}

interface SummaryMetric {
  title: string;
  value: string | number;
  description: string;
  icon: LucideIcon;
  color: string;
  bg: string;
  destructive?: boolean;
}

export default function SummaryCards({ data, loading }: SummaryCardsProps) {
  const cards: SummaryMetric[] = [
    {
      title: "Journal Count",
      value: data.jeCount,
      description: "Entries in current analysis",
      icon: FileText,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-900/20",
    },
    {
      title: "Total Debit",
      value: formatJournalAmount(data.totalDebit),
      description: "Filtered debit total",
      icon: ArrowUpCircle,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-900/20",
    },
    {
      title: "Total Credit",
      value: formatJournalAmount(data.totalCredit),
      description: "Filtered credit total",
      icon: ArrowDownCircle,
      color: "text-rose-600 dark:text-rose-400",
      bg: "bg-rose-50 dark:bg-rose-900/20",
    },
    {
      title: "Debit–Credit Difference",
      value: formatJournalAmount(data.netBalance),
      description: "Debit minus credit; negative means credits exceed debits",
      icon: Scale,
      color: data.netBalance !== 0 ? "text-white" : "text-slate-600 dark:text-slate-400",
      bg: data.netBalance !== 0 ? "bg-red-700/80" : "bg-slate-50 dark:bg-slate-800/50",
      destructive: data.netBalance !== 0,
    },
  ];

  return <SummaryMetricGrid cards={cards} loading={loading} />;
}

export function SecondarySummaryCards({ data, loading }: SummaryCardsProps) {
  const cards: SummaryMetric[] = [
    {
      title: "Largest Entry",
      value: formatJournalAmount(data.largestEntry),
      description: "Highest single line amount",
      icon: Zap,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-900/20",
    },
    {
      title: "Imbalanced JEs",
      value: data.imbalancedCount,
      description: "Entries needing review",
      icon: AlertTriangle,
      color: data.imbalancedCount > 0 ? "text-red-600 dark:text-red-400" : "text-slate-400",
      bg: data.imbalancedCount > 0 ? "bg-red-50 dark:bg-red-900/20" : "bg-slate-50 dark:bg-slate-800/50",
    },
    {
      title: "Posted vs Unposted",
      value: `${data.postedCount} / ${data.unpostedCount}`,
      description: "Current processing state",
      icon: LogOut,
      color: "text-indigo-600 dark:text-indigo-400",
      bg: "bg-indigo-50 dark:bg-indigo-900/20",
    },
  ];

  return <SummaryMetricGrid cards={cards} loading={loading} columns={3} />;
}

function SummaryMetricGrid({
  cards,
  loading,
  columns = 4,
}: {
  cards: SummaryMetric[];
  loading?: boolean;
  columns?: 3 | 4;
}) {
  return (
    <div className={cn("grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2", columns === 3 ? "xl:grid-cols-3" : "xl:grid-cols-4")}>
      {cards.map((card) => (
        <Card
          key={card.title}
          className={cn(
            "min-w-0 border shadow-sm transition-shadow hover:shadow-md",
            card.destructive
              ? "bg-destructive text-destructive-foreground border-destructive ring-2 ring-destructive ring-offset-2"
              : "bg-card text-card-foreground border-border",
          )}
        >
          <CardHeader className="flex min-w-0 flex-row items-start justify-between gap-2 space-y-0 px-4 pb-2 pt-4">
            <CardTitle
              className={cn(
                "min-w-0 break-words text-xs font-semibold uppercase leading-snug tracking-wide",
                card.destructive ? "text-destructive-foreground/90" : "text-muted-foreground",
              )}
            >
              {card.title}
            </CardTitle>
            <div className={cn("shrink-0 rounded-lg p-2", card.bg)}>
              <card.icon className={cn("h-4 w-4", card.color)} />
            </div>
          </CardHeader>
          <CardContent className="min-w-0 px-4 pb-4">
            {loading ? (
              <div className="space-y-2">
                <Skeleton className={cn("h-7 w-full max-w-[180px]", card.destructive ? "bg-white/20" : "bg-muted")} />
                <Skeleton className={cn("h-3 w-full max-w-[120px]", card.destructive ? "bg-white/20" : "bg-muted")} />
              </div>
            ) : (
              <>
                <div className="min-w-0 break-words text-xl font-semibold leading-tight tracking-tight tabular-nums [overflow-wrap:anywhere] sm:text-2xl">
                  {card.value}
                </div>
                <p
                  className={cn(
                    "mt-1 break-words text-xs",
                    card.destructive ? "font-medium text-destructive-foreground/80" : "text-muted-foreground",
                  )}
                >
                  {card.description}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
