"use client";

import { useFinancialPerformance } from "../hooks/useFinancialPerformance";
import { formatCurrency } from "@/lib/utils";

// Assuming formatCurrency exists. If not, I'll provide a local fallback.
const formatAmount = (amount?: number) => {
  if (amount === undefined) return "₱0.00";
  const formatter = new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  });
  return formatter.format(amount);
};

export function SummaryCards() {
  const { data, isLoading, isInitialLoad } = useFinancialPerformance();

  const totalSales = Math.abs(data?.totalRevenue ?? 0);
  const cogs = data?.totalCostOfSales ?? 0;
  // Total expenses 
  const totalExpenses = (data?.totalOperatingExpenses ?? 0) + (data?.totalOtherExpense ?? 0);
  const netOtherIncome = (data?.totalOtherIncome ?? 0) - (data?.totalOtherExpense ?? 0);
  const netIncome = data?.netIncome ?? 0;

  const CardSkeleton = () => (
    <div className="flex-1 min-w-[200px] border border-border bg-card rounded-2xl p-5 shadow-sm animate-pulse">
      <div className="h-4 w-24 bg-muted rounded mb-4"></div>
      <div className="h-7 w-32 bg-muted rounded mb-6"></div>
      <div className="h-3 w-40 bg-muted rounded"></div>
    </div>
  );

  const EmptyCard = ({ title, subtitle }: { title: string, subtitle: string }) => (
    <div className="flex-1 min-w-[200px] border border-dashed border-border bg-card/50 rounded-2xl p-5 shadow-sm">
      <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">{title}</h4>
      <div className="text-2xl font-bold text-muted-foreground/50 mb-4">—</div>
      <p className="text-xs text-muted-foreground font-medium">{subtitle}</p>
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex flex-wrap gap-4 mb-6">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  if (isInitialLoad) {
    return (
      <div className="flex flex-wrap gap-4 mb-6">
        <EmptyCard title="Total Sales" subtitle="Before deductions" />
        <EmptyCard title="COGS" subtitle="Cost of goods sold" />
        <EmptyCard title="Total Expenses" subtitle="Operating + Other expenses" />
        <EmptyCard title="Net Other Income (Loss)" subtitle="Income vs Expense" />
        <EmptyCard title="Net Income" subtitle="After tax" />
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-4 mb-6">
      <div className="flex-1 min-w-[200px] border border-border bg-card rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
        <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Total Sales</h4>
        <div className="text-2xl font-bold text-foreground mb-4">{formatAmount(totalSales)}</div>
        <p className="text-xs text-muted-foreground font-medium">Before deductions</p>
      </div>

      <div className="flex-1 min-w-[200px] border border-border bg-card rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
        <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Cost of Goods Sold</h4>
        <div className="text-2xl font-bold text-foreground mb-4">{formatAmount(cogs)}</div>
        <p className="text-xs text-muted-foreground font-medium">Cost of goods sold</p>
      </div>

      <div className="flex-1 min-w-[200px] border border-border bg-card rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
        <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Total Expenses</h4>
        <div className="text-2xl font-bold text-foreground mb-4">{formatAmount(totalExpenses)}</div>
        <p className="text-xs text-muted-foreground font-medium">Operating + Other expenses</p>
      </div>

      <div className="flex-1 min-w-[200px] border border-border bg-card rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
        <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Net Other Income (Loss)</h4>
        <div className="text-2xl font-bold text-foreground mb-4">{formatAmount(netOtherIncome)}</div>
        <p className="text-[11px] text-muted-foreground font-medium">
          Income: {formatAmount(data?.totalOtherIncome)} | Expense: {formatAmount(data?.totalOtherExpense)}
        </p>
      </div>

      <div className="flex-1 min-w-[200px] border border-border bg-card rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
        <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Net Income</h4>
        <div className="text-2xl font-bold text-foreground mb-4">{formatAmount(netIncome)}</div>
        <p className="text-xs text-muted-foreground font-medium">After tax</p>
      </div>
    </div>
  );
}
