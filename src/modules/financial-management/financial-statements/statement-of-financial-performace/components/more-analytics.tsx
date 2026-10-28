"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useFinancialPerformance } from "../hooks/useFinancialPerformance";
import { formatFinancialPerformanceRatioChange, getFinancialPerformanceRatioChange } from "../utils/variances";

export function MoreAnalytics() {
  const { data, reportError, appliedCriteria, comparisonStatus, isInitialLoad, isLoading } = useFinancialPerformance();
  const [isOpen, setIsOpen] = useState(false);

  if (reportError && !data) return null;

  const ratios = [
    {
      title: "Gross Profit Margin",
      subtitle: "Gross Profit ÷ Revenue",
      value: data?.grossProfitMargin,
      priorValue: data?.comparisonData?.grossProfitMargin,
    },
    {
      title: "Operating Expense Ratio",
      subtitle: "Operating Expenses ÷ Revenue",
      value: data?.operatingExpenseRatio,
      priorValue: data?.comparisonData?.operatingExpenseRatio,
    },
    {
      title: "Net Profit Margin",
      subtitle: "Net Income ÷ Revenue",
      value: data?.netProfitMargin,
      priorValue: data?.comparisonData?.netProfitMargin,
    },
    {
      title: "Effective Tax Rate",
      subtitle: "Income Tax Expense ÷ Income Before Tax",
      value: data?.effectiveTaxRate,
      priorValue: data?.comparisonData?.effectiveTaxRate,
    },
  ];

  return (
    <section className="min-w-0" aria-busy={isLoading}>
      <Button
        type="button"
        variant="outline"
        aria-expanded={isOpen}
        aria-controls="sfp-more-analytics-content"
        onClick={() => setIsOpen(open => !open)}
        className="h-auto min-h-12 w-full justify-between gap-3 px-4 py-3 text-left focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="min-w-0">
          <span className="block text-sm font-semibold">More analytics</span>
          <span className="block text-xs font-normal text-muted-foreground">Profitability and expense ratios</span>
        </span>
        <ChevronDown aria-hidden="true" className={cn("h-4 w-4 shrink-0 transition-transform", isOpen && "rotate-180")} />
      </Button>

      <div id="sfp-more-analytics-content" hidden={!isOpen} className="mt-3 min-w-0">
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {ratios.map(({ title, subtitle, value, priorValue }) => {
            const comparisonAvailable = appliedCriteria?.includeComparison === true
              && comparisonStatus === "available"
              && data?.comparisonData !== undefined;
            const variance = getFinancialPerformanceRatioChange(value, priorValue);

            return (
              <div key={title} className="flex min-w-0 flex-col gap-1 rounded-lg border border-border bg-card p-4 shadow-sm">
                <span className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">{title}</span>
                <span className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">{subtitle}</span>
                <div className="mt-2 flex min-w-0 items-center justify-between gap-2">
                  <span className="text-xl font-bold tracking-tight text-foreground">
                    {isInitialLoad || !data ? "—" : value == null ? "Not applicable" : `${value.toFixed(2)}%`}
                  </span>
                  {!isInitialLoad && comparisonAvailable && (
                    <span className="min-w-0 rounded bg-muted px-2 py-0.5 text-right text-[11px] font-medium text-muted-foreground">
                      {variance === undefined ? "Change not applicable" : formatFinancialPerformanceRatioChange(variance)}
                    </span>
                  )}
                  {!isInitialLoad && appliedCriteria?.includeComparison && comparisonStatus === "loading" && (
                    <span className="text-[11px] font-medium text-muted-foreground">Loading comparison…</span>
                  )}
                  {!isInitialLoad && appliedCriteria?.includeComparison && comparisonStatus === "unavailable" && (
                    <span className="shrink-0 text-[11px] font-medium text-muted-foreground">Comparison unavailable</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
