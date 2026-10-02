"use client";

import React from "react";
import { ExpenseSummaryItem } from "../types";
import { Receipt, Clock, CheckCircle2, FileEdit } from "lucide-react";

interface SummaryMetricsCardsProps {
  expenses: ExpenseSummaryItem[];
  activeFilterStatuses?: string[];
  onSelectFilter?: (status: string) => void;
}

export const SummaryMetricsCards: React.FC<SummaryMetricsCardsProps> = ({
  expenses,
  activeFilterStatuses = [],
  onSelectFilter,
}) => {
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(val || 0);
  };

  const totalCount = expenses.length;
  const totalAmount = expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const draftItems = expenses.filter((i) => i.status === "Draft");
  const draftCount = draftItems.length;
  const draftAmount = draftItems.reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const pendingItems = expenses.filter((i) => i.status === "Pending Approval");
  const pendingCount = pendingItems.length;
  const pendingAmount = pendingItems.reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const approvedItems = expenses.filter(
    (i) => i.status === "Submitted To Disbursement" || i.is_final_approved
  );
  const approvedCount = approvedItems.length;
  const approvedAmount = approvedItems.reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const isAllActive = activeFilterStatuses.length === 0;

  const handleCardClick = (statusKey: string) => {
    if (!onSelectFilter) return;
    onSelectFilter(statusKey);
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
      {/* 1. Total Expenses */}
      <div
        onClick={() => handleCardClick("ALL")}
        className={`bg-card border rounded-xl p-3.5 flex flex-col justify-between shadow-xs transition-all cursor-pointer select-none ${
          isAllActive
            ? "border-primary ring-2 ring-primary/20 bg-primary/5 dark:bg-primary/10"
            : "border-border dark:border-zinc-700/80 hover:border-primary/50 dark:bg-zinc-900/80"
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Total Expenses
          </span>
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <Receipt className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2">
          <div className="text-xl font-mono font-bold text-foreground">
            {formatCurrency(totalAmount)}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5 font-mono">
            {totalCount} {totalCount === 1 ? "record" : "records"}
          </p>
        </div>
      </div>

      {/* 2. Draft Receipts */}
      <div
        onClick={() => handleCardClick("Draft")}
        className={`bg-card border rounded-xl p-3.5 flex flex-col justify-between shadow-xs transition-all cursor-pointer select-none ${
          activeFilterStatuses.includes("Draft")
            ? "border-zinc-400 ring-2 ring-zinc-400/20 bg-zinc-500/5 dark:bg-zinc-500/10"
            : "border-border dark:border-zinc-700/80 hover:border-zinc-400/50 dark:bg-zinc-900/80"
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Draft Receipts
          </span>
          <div className="p-2 rounded-lg bg-zinc-500/10 text-zinc-500 dark:text-zinc-400">
            <FileEdit className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2">
          <div className="text-xl font-mono font-bold text-muted-foreground">
            {formatCurrency(draftAmount)}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5 font-mono">
            {draftCount} {draftCount === 1 ? "draft" : "drafts"}
          </p>
        </div>
      </div>

      {/* 3. Pending Approval */}
      <div
        onClick={() => handleCardClick("Pending Approval")}
        className={`bg-card border rounded-xl p-3.5 flex flex-col justify-between shadow-xs transition-all cursor-pointer select-none ${
          activeFilterStatuses.includes("Pending Approval")
            ? "border-amber-500 ring-2 ring-amber-500/20 bg-amber-500/5 dark:bg-amber-500/10"
            : "border-border dark:border-zinc-700/80 hover:border-amber-500/50 dark:bg-zinc-900/80"
        }`}
      >
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
          <p className="text-[11px] text-muted-foreground mt-0.5 font-mono">
            {pendingCount} {pendingCount === 1 ? "pending review" : "pending review"}
          </p>
        </div>
      </div>

      {/* 4. Approved */}
      <div
        onClick={() => handleCardClick("Submitted To Disbursement")}
        className={`bg-card border rounded-xl p-3.5 flex flex-col justify-between shadow-xs transition-all cursor-pointer select-none ${
          activeFilterStatuses.includes("Submitted To Disbursement")
            ? "border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-500/10"
            : "border-border dark:border-zinc-700/80 hover:border-emerald-500/50 dark:bg-zinc-900/80"
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Approved
          </span>
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2">
          <div className="text-xl font-mono font-bold text-emerald-500">
            {formatCurrency(approvedAmount)}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5 font-mono">
            {approvedCount} {approvedCount === 1 ? "approved record" : "approved records"}
          </p>
        </div>
      </div>
    </div>
  );
};
