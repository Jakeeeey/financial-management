"use client";

import * as React from "react";
import { 
  FileText, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  Scale, 
  Zap, 
  AlertTriangle, 
  LogOut 
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AnalyticsSummary } from "../types";
import { cn, formatCurrency } from "@/lib/utils";

interface SummaryCardsProps {
  data: AnalyticsSummary;
}

export default function SummaryCards({ data }: SummaryCardsProps) {
  const cards = [
    {
      title: "Journal Entry Count",
      value: data.jeCount,
      description: "Entries in current analysis",
      icon: FileText,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      title: "Total Debit",
      value: formatCurrency(data.totalDebit),
      description: "Filtered debit total",
      icon: ArrowUpCircle,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      title: "Total Credit",
      value: formatCurrency(data.totalCredit),
      description: "Filtered credit total",
      icon: ArrowDownCircle,
      color: "text-rose-600",
      bg: "bg-rose-50",
    },
    {
      title: "Ending Balance",
      value: formatCurrency(data.netBalance),
      description: data.netBalance !== 0 ? "Imbalance detected" : "Perfectly balanced",
      icon: Scale,
      color: data.netBalance !== 0 ? "text-orange-600" : "text-slate-600",
      bg: data.netBalance !== 0 ? "bg-orange-50" : "bg-slate-50",
      highlight: data.netBalance !== 0,
    },
    {
      title: "Largest Entry",
      value: formatCurrency(data.largestEntry),
      description: "Highest single line amount",
      icon: Zap,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
    {
      title: "Imbalanced JES",
      value: data.imbalancedCount,
      description: "Entries needing review",
      icon: AlertTriangle,
      color: data.imbalancedCount > 0 ? "text-red-600" : "text-slate-400",
      bg: data.imbalancedCount > 0 ? "bg-red-50" : "bg-slate-50",
    },
    {
      title: "Posted vs Unposted",
      value: `${data.postedCount} / ${data.unpostedCount}`,
      description: "Current processing state",
      icon: LogOut,
      color: "text-indigo-600",
      bg: "bg-indigo-50",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
      {cards.map((card, i) => (
        <Card 
          key={i} 
          className={cn(
            "overflow-hidden border-none shadow-sm transition-all hover:shadow-md",
            card.highlight && "ring-2 ring-orange-500 ring-offset-2"
          )}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {card.title}
            </CardTitle>
            <div className={cn("p-2 rounded-lg", card.bg)}>
              <card.icon className={cn("h-4 w-4", card.color)} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold tracking-tight">{card.value}</div>
            <p className="text-[10px] text-muted-foreground mt-1 truncate">
              {card.description}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
