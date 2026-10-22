"use client";

import { useFinancialPerformance } from "../hooks/useFinancialPerformance";

const formatAmount = (amount?: number) => {
  if (amount === undefined) return "₱0.00";
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(amount);
};

const metricTitles = ["Total Sales", "Gross Profit", "Total Expenses", "Net Income"];

const CardSkeleton = () => (
  <div className="min-w-0 animate-pulse rounded-xl border border-border bg-card p-4 shadow-sm">
    <div className="mb-3 h-3 w-24 rounded bg-muted" />
    <div className="h-6 w-32 max-w-full rounded bg-muted" />
  </div>
);

export function SummaryCards() {
  const { data, isLoading, isInitialLoad } = useFinancialPerformance();

  if (isLoading && !data) {
    return (
      <div className="mb-4 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Loading financial metrics">
        {metricTitles.map(title => <CardSkeleton key={title} />)}
      </div>
    );
  }

  if (isInitialLoad || !data) {
    return (
      <div className="mb-4 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Financial metrics">
        {metricTitles.map(title => (
          <div key={title} className="min-w-0 rounded-xl border border-dashed border-border bg-card/50 p-4 shadow-sm">
            <h3 className="text-xs font-semibold text-muted-foreground">{title}</h3>
            <div className="mt-2 text-xl font-bold text-muted-foreground/50">—</div>
          </div>
        ))}
      </div>
    );
  }

  const totalExpenses = (data.totalOperatingExpenses ?? 0) + (data.totalOtherExpense ?? 0);
  const metrics = [
    { title: "Total Sales", value: data.totalRevenue, subtitle: "Before deductions" },
    { title: "Gross Profit", value: data.grossProfit, subtitle: "Sales less cost of sales" },
    { title: "Total Expenses", value: totalExpenses, subtitle: "Operating and other expenses" },
    { title: "Net Income", value: data.netIncome, subtitle: "After tax" },
  ];

  return (
    <div className="mb-4 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Financial metrics">
      {metrics.map(metric => (
        <div key={metric.title} className="min-w-0 rounded-xl border border-border bg-card p-4 shadow-sm">
          <h3 className="text-xs font-semibold text-muted-foreground">{metric.title}</h3>
          <div className="mt-2 text-xl font-bold leading-tight tabular-nums text-foreground [overflow-wrap:anywhere]">
            {formatAmount(metric.value)}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{metric.subtitle}</p>
        </div>
      ))}
    </div>
  );
}
