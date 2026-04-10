"use client";

import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, CheckCircle2, ListFilter } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils";
import { TrialBalanceSummaryData } from "../types/trial-balance.schema";

interface SummaryCardProps {
  label: string;
  value: string | number;
  subLabel?: string;
  type?: "default" | "error" | "info" | "success";
  icon?: React.ReactNode;
}

function SummaryCard({ label, value, subLabel, type = "default", icon }: SummaryCardProps) {
  return (
    <Card className={cn(
      "border-l-4 overflow-hidden",
      type === "default" && "border-l-primary/20",
      type === "error" && "border-l-destructive bg-destructive/5",
      type === "info" && "border-l-blue-500",
      type === "success" && "border-l-green-500"
    )}>
      <CardContent className="p-4 flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <div className="flex items-baseline gap-2">
            <h2 className={cn(
              "text-2xl font-bold tracking-tight",
              type === "error" && "text-destructive"
            )}>
              {value}
            </h2>
          </div>
          {subLabel && <p className="text-xs text-muted-foreground">{subLabel}</p>}
        </div>
        {icon && <div className="text-muted-foreground/20">{icon}</div>}
      </CardContent>
    </Card>
  );
}

export function TrialBalanceSummary({ summary }: { summary: TrialBalanceSummaryData }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <SummaryCard
        label="Total Debit"
        value={formatCurrency(summary.totalDebit)}
        icon={<ListFilter className="h-8 w-8" />}
      />
      <SummaryCard
        label="Total Credit"
        value={formatCurrency(summary.totalCredit)}
      />
      <SummaryCard
        label="Difference"
        value={formatCurrency(summary.difference)}
        type={summary.isBalanced ? "success" : "error"}
        subLabel={summary.isBalanced ? "Report is balanced" : "Mismatch detected"}
        icon={summary.isBalanced ? <CheckCircle2 className="h-8 w-8 text-green-500" /> : <AlertCircle className="h-8 w-8 text-destructive" />}
      />
      <SummaryCard
        label="Accounts"
        value={summary.accountCount}
        subLabel="Unique accounts found"
      />
    </div>
  );
}
