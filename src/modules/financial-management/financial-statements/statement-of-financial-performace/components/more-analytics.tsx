"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useFinancialPerformance } from "../hooks/useFinancialPerformance";

export function MoreAnalytics() {
  const { data, isInitialLoad } = useFinancialPerformance();
  const [isOpen, setIsOpen] = useState(false);

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
    <section className="min-w-0">
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
            const current = value ?? 0;
            const prior = priorValue ?? 0;
            const variance = current - prior;
            const isPositive = current > prior;
            const isNegative = current < prior;
            const isNeutral = current === prior;

            return (
              <div key={title} className="flex min-w-0 flex-col gap-1 rounded-lg border border-border bg-card p-4 shadow-sm">
                <span className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">{title}</span>
                <span className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">{subtitle}</span>
                <div className="mt-2 flex min-w-0 items-center justify-between gap-2">
                  <span className="text-xl font-bold tracking-tight text-foreground">
                    {isInitialLoad ? "—" : `${current.toFixed(1)}%`}
                  </span>
                  {!isInitialLoad && (priorValue !== undefined || variance !== 0) && (
                    <span
                      className={cn("shrink-0 rounded px-2 py-0.5 text-[11px] font-bold", {
                        "bg-success/10 text-success": isPositive,
                        "bg-destructive/10 text-destructive": isNegative,
                        "bg-muted text-muted-foreground": isNeutral,
                      })}
                    >
                      {isPositive ? "▲ " : isNegative ? "▼ " : ""}{variance > 0 ? "+" : ""}{variance.toFixed(1)}%
                    </span>
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
