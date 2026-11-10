"use client";

import { formatCurrency } from "@/lib/utils";

import type { TaxScenario } from "../types";

/**
 * The desk shows both readings of "cost of sales" instead of picking one, because the
 * choice moves taxable income by hundreds of millions in a stock-building year and only
 * an accountant can settle which figure the return should carry.
 */

const rows: Array<{ label: string; pick: (scenario: TaxScenario) => number; strong?: boolean }> = [
  { label: "Gross income", pick: (scenario) => scenario.annual.grossIncome },
  { label: "Deductions", pick: (scenario) => scenario.annual.deductions },
  { label: "Net taxable income", pick: (scenario) => scenario.annual.netTaxableIncome },
  { label: "Regular income tax", pick: (scenario) => scenario.annual.regular },
  { label: "Minimum corporate income tax", pick: (scenario) => scenario.annual.mcit },
  { label: "Tax due for the year", pick: (scenario) => scenario.annual.taxDue, strong: true },
  { label: "Less credits and prior overpayment", pick: (scenario) => scenario.annual.taxDue - scenario.annual.netPosition },
  { label: "Net position", pick: (scenario) => scenario.annual.netPosition, strong: true },
];

export function BasisComparison({ scenarios, year }: { scenarios: TaxScenario[]; year: number }) {
  if (scenarios.length === 0) return null;

  return (
    <section
      aria-label="Tax under each cost of sales basis"
      className="overflow-hidden rounded-2xl border border-border/50 border-t-[3px] border-t-indigo-500/60 bg-card shadow-sm"
    >
      <div className="border-b px-4 py-3">
        <h2 className="text-sm font-semibold">Tax under each cost of sales basis</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {year} has no cost-of-sales ledger, so both readings are shown. The worksheet carries the first column.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="py-2 pl-5 pr-4 text-left font-medium">
                Measure
              </th>
              {scenarios.map((scenario, index) => (
                <th key={scenario.basis} scope="col" className="py-2 pl-4 pr-5 text-right font-medium">
                  {scenario.label}
                  {index === 0 ? <span className="ml-2 normal-case text-muted-foreground">(worksheet)</span> : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {rows.map((row) => (
              <tr key={row.label} className={row.strong ? "bg-muted/30 font-medium" : undefined}>
                <th scope="row" className="py-2.5 pl-5 pr-4 text-left font-normal">
                  {row.label}
                </th>
                {scenarios.map((scenario) => {
                  const value = row.pick(scenario);
                  return (
                    <td key={scenario.basis} className="py-2.5 pl-4 pr-5 text-right tabular-nums">
                      <span className={value < -0.005 ? "text-red-600 dark:text-red-400" : undefined}>
                        {formatCurrency(value)}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr className="text-xs text-muted-foreground">
              <th scope="row" className="py-2.5 pl-5 pr-4 text-left font-normal">
                Rate applied
              </th>
              {scenarios.map((scenario) => (
                <td key={scenario.basis} className="py-2.5 pl-4 pr-5 text-right tabular-nums">
                  {(scenario.rate * 100).toFixed(0)}%{scenario.mcitApplied ? " · MCIT applies" : ""}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}


