"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ExpenseItem } from "../types";
import { Receipt, Clock, AlertTriangle, CheckCircle2, DollarSign } from "lucide-react";

interface ExpenseSummaryCardsProps {
  expenses: ExpenseItem[];
}

export const ExpenseSummaryCards: React.FC<ExpenseSummaryCardsProps> = ({ expenses }) => {
  const totalCount = expenses.length;

  const pendingCount = expenses.filter((e) => e.status === "Pending Approval").length;
  const concernCount = expenses.filter((e) => e.status === "With Concern").length;
  const approvedCount = expenses.filter((e) => e.status === "Submitted To Disbursement").length;

  const totalAmount = expenses.reduce((acc, curr) => {
    if (curr.status !== "Rejected" && curr.status !== "Draft") {
      return acc + (Number(curr.amount) || 0);
    }
    return acc;
  }, 0);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 2,
    }).format(val);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      {/* Total Expense Amount */}
      <Card className="bg-card/50 backdrop-blur border-border/60 hover:border-emerald-500/40 transition-colors shadow-xs">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Amount</p>
            <h3 className="text-xl font-mono font-bold mt-1 text-emerald-500">{formatCurrency(totalAmount)}</h3>
          </div>
          <div className="p-2.5 bg-emerald-500/10 text-emerald-500 rounded-xl">
            <DollarSign className="w-5 h-5" />
          </div>
        </CardContent>
      </Card>

      {/* Total Receipts */}
      <Card className="bg-card/50 backdrop-blur border-border/60 hover:border-primary/40 transition-colors shadow-xs">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Receipts</p>
            <h3 className="text-2xl font-bold mt-1 text-foreground font-mono">{totalCount}</h3>
          </div>
          <div className="p-2.5 bg-primary/10 text-primary rounded-xl">
            <Receipt className="w-5 h-5" />
          </div>
        </CardContent>
      </Card>

      {/* Pending Approval */}
      <Card className="bg-card/50 backdrop-blur border-border/60 hover:border-amber-500/40 transition-colors shadow-xs">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pending Approval</p>
            <h3 className="text-2xl font-bold mt-1 text-amber-500 font-mono">{pendingCount}</h3>
          </div>
          <div className="p-2.5 bg-amber-500/10 text-amber-500 rounded-xl">
            <Clock className="w-5 h-5" />
          </div>
        </CardContent>
      </Card>

      {/* Needs Revision (With Concern) */}
      <Card className="bg-card/50 backdrop-blur border-border/60 hover:border-orange-500/40 transition-colors shadow-xs">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Needs Revision</p>
            <h3 className="text-2xl font-bold mt-1 text-orange-500 font-mono">{concernCount}</h3>
          </div>
          <div className="p-2.5 bg-orange-500/10 text-orange-500 rounded-xl">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </CardContent>
      </Card>

      {/* Approved to Disbursement */}
      <Card className="bg-card/50 backdrop-blur border-border/60 hover:border-emerald-500/40 transition-colors shadow-xs">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Approved</p>
            <h3 className="text-2xl font-bold mt-1 text-emerald-500 font-mono">{approvedCount}</h3>
          </div>
          <div className="p-2.5 bg-emerald-500/10 text-emerald-500 rounded-xl">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
