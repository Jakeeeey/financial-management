"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ExpenseItem } from "../types";
import { Clock, AlertTriangle, CheckCircle2, DollarSign, FileEdit } from "lucide-react";

interface ExpenseSummaryCardsProps {
  expenses: ExpenseItem[];
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

export const ExpenseSummaryCards: React.FC<ExpenseSummaryCardsProps> = ({
  expenses,
  activeTab = "all",
  onTabChange,
}) => {
  // Counts
  const totalCount = expenses.length;
  const draftExpenses = expenses.filter((e) => e.status === "Draft");
  const pendingExpenses = expenses.filter((e) => e.status === "Pending Approval");
  const concernExpenses = expenses.filter((e) => e.status === "With Concern");
  const approvedExpenses = expenses.filter((e) => e.status === "Submitted To Disbursement");

  // Sum amounts per category
  const sumAmount = (items: ExpenseItem[]) =>
    items.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

  const totalAmount = sumAmount(expenses.filter((e) => e.status !== "Rejected"));
  const draftAmount = sumAmount(draftExpenses);
  const pendingAmount = sumAmount(pendingExpenses);
  const concernAmount = sumAmount(concernExpenses);
  const approvedAmount = sumAmount(approvedExpenses);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 2,
    }).format(val);
  };

  const cards = [
    {
      id: "all",
      label: "Total Expenses",
      amount: totalAmount,
      count: totalCount,
      countLabel: totalCount === 1 ? "1 receipt" : `${totalCount} receipts`,
      icon: DollarSign,
      accentColor: "emerald",
      borderActive: "ring-2 ring-emerald-500/80 border-emerald-500",
      topBorder: "border-t-2 border-t-emerald-500",
      badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
      amountClass: "text-emerald-600 dark:text-emerald-400",
      iconBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    },
    {
      id: "draft",
      label: "Draft Receipts",
      amount: draftAmount,
      count: draftExpenses.length,
      countLabel: draftExpenses.length === 1 ? "1 draft" : `${draftExpenses.length} drafts`,
      icon: FileEdit,
      accentColor: "slate",
      borderActive: "ring-2 ring-slate-400/80 border-slate-400",
      topBorder: "border-t-2 border-t-slate-400",
      badgeClass: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20",
      amountClass: "text-slate-700 dark:text-slate-200",
      iconBg: "bg-slate-500/10 text-slate-700 dark:text-slate-300",
    },
    {
      id: "pending",
      label: "Pending Approval",
      amount: pendingAmount,
      count: pendingExpenses.length,
      countLabel: pendingExpenses.length === 1 ? "1 pending" : `${pendingExpenses.length} pending`,
      icon: Clock,
      accentColor: "blue",
      borderActive: "ring-2 ring-blue-500/80 border-blue-500",
      topBorder: "border-t-2 border-t-blue-500",
      badgeClass: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
      amountClass: "text-blue-600 dark:text-blue-400",
      iconBg: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    },
    {
      id: "concern",
      label: "Needs Revision",
      amount: concernAmount,
      count: concernExpenses.length,
      countLabel: concernExpenses.length === 1 ? "1 action required" : `${concernExpenses.length} action required`,
      icon: AlertTriangle,
      accentColor: "amber",
      borderActive: "ring-2 ring-amber-500/80 border-amber-500",
      topBorder: "border-t-2 border-t-amber-500",
      badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
      amountClass: "text-amber-600 dark:text-amber-400",
      iconBg: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    },
    {
      id: "approved",
      label: "Approved & Forwarded",
      amount: approvedAmount,
      count: approvedExpenses.length,
      countLabel: approvedExpenses.length === 1 ? "1 approved" : `${approvedExpenses.length} approved`,
      icon: CheckCircle2,
      accentColor: "emerald",
      borderActive: "ring-2 ring-emerald-500/80 border-emerald-500",
      topBorder: "border-t-2 border-t-emerald-500",
      badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
      amountClass: "text-emerald-600 dark:text-emerald-400",
      iconBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
      {cards.map((card) => {
        const Icon = card.icon;
        const isSelected = activeTab === card.id;

        return (
          <Card
            key={card.id}
            onClick={() => onTabChange && onTabChange(card.id)}
            className={`relative overflow-hidden transition-all duration-200 cursor-pointer select-none bg-card hover:shadow-md hover:translate-y-[-1px] border border-border/70 ${card.topBorder} ${
              isSelected ? `${card.borderActive} shadow-sm bg-accent/20` : "hover:border-border/90"
            }`}
          >
            <CardContent className="p-4 flex flex-col justify-between h-full space-y-3">
              {/* Header: Label + Icon */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider truncate">
                  {card.label}
                </span>
                <div className={`p-2 rounded-lg shrink-0 ${card.iconBg}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>

              {/* Main Metric: Amount */}
              <div>
                <h3 className={`text-lg sm:text-xl font-bold font-mono tracking-tight ${card.amountClass}`}>
                  {formatCurrency(card.amount)}
                </h3>
              </div>

              {/* Footer: Count Pill Badge */}
              <div className="flex items-center justify-between pt-1 border-t border-border/40">
                <span className="text-[11px] text-muted-foreground font-medium">Volume</span>
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${card.badgeClass}`}
                >
                  {card.countLabel}
                </span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
