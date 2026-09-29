"use client";

import React from "react";
import { ExpenseSummaryItem } from "../types";
import { Receipt, Clock, CheckCircle2, AlertTriangle } from "lucide-react";

interface SummaryMetricsCardsProps {
  expenses: ExpenseSummaryItem[];
}

export const SummaryMetricsCards: React.FC<SummaryMetricsCardsProps> = ({ expenses }) => {
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(val || 0);
  };

  const totalCount = expenses.length;
  const totalAmount = expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const pendingItems = expenses.filter((i) => i.status === "Pending Approval");
  const pendingCount = pendingItems.length;
  const pendingAmount = pendingItems.reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const approvedItems = expenses.filter((i) => i.status === "Submitted To Disbursement" || i.is_final_approved);
  const approvedCount = approvedItems.length;
  const approvedAmount = approvedItems.reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const concernOrRejectedItems = expenses.filter((i) => i.status === "With Concern" || i.status === "Rejected" || i.has_concern);
  const concernOrRejectedCount = concernOrRejectedItems.length;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
      {/* 1. Total Expenses */}
      <div className="bg-card border border-border dark:border-zinc-700/80 dark:bg-zinc-900/80 rounded-xl p-3.5 flex flex-col justify-between shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Total Expense Records
          </span>
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <Receipt className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2">
          <div className="text-xl font-mono font-bold text-foreground">
            {formatCurrency(totalAmount)}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {totalCount} {totalCount === 1 ? "expense record" : "total expense records"}
          </p>
        </div>
      </div>

      {/* 2. Pending Approval */}
      <div className="bg-card border border-border dark:border-zinc-700/80 dark:bg-zinc-900/80 rounded-xl p-3.5 flex flex-col justify-between shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Pending Approval
          </span>
          <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
            <Clock className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2">
          <div className="text-xl font-mono font-bold text-amber-500">
            {formatCurrency(pendingAmount)}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {pendingCount} {pendingCount === 1 ? "receipt pending" : "receipts pending review"}
          </p>
        </div>
      </div>

      {/* 3. Submitted To Disbursement */}
      <div className="bg-card border border-border dark:border-zinc-700/80 dark:bg-zinc-900/80 rounded-xl p-3.5 flex flex-col justify-between shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            To Disbursement
          </span>
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2">
          <div className="text-xl font-mono font-bold text-emerald-500">
            {formatCurrency(approvedAmount)}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {approvedCount} {approvedCount === 1 ? "expense handoff" : "approved handoffs"}
          </p>
        </div>
      </div>

      {/* 4. With Concern / Rejected */}
      <div className="bg-card border border-border dark:border-zinc-700/80 dark:bg-zinc-900/80 rounded-xl p-3.5 flex flex-col justify-between shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Concern / Flagged
          </span>
          <div className="p-2 rounded-lg bg-rose-500/10 text-rose-500">
            <AlertTriangle className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2">
          <div className="text-xl font-mono font-bold text-rose-500">
            {concernOrRejectedCount} <span className="text-xs font-sans font-normal text-muted-foreground">records</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            With concern or rejected logs
          </p>
        </div>
      </div>
    </div>
  );
};
