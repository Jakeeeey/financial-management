"use client";

import { Badge } from "@/components/ui/badge";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";
import type { ExpenseBreakdown } from "../types";

/**
 * Line 6 is one number; this is where it comes from.
 *
 * The disbursement ledger holds every peso that left the bank for the year, and only the
 * income-statement account types are deductions, so the panel shows both halves rather than
 * a single unexplained total.
 */
export function DeductionBreakdown({ breakdown, year }: { breakdown: ExpenseBreakdown | null; year: number }) {
  if (!breakdown || breakdown.rows.length === 0) {
    return (
      <section
        aria-label="Deduction breakdown"
        className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-sm"
      >
        <div className="border-b border-border/50 px-4 py-3">
          <h2 className="text-sm font-semibold">How the deduction line is built</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            The disbursement view could not be read for {year}, so the account breakdown is not available.
          </p>
        </div>
      </section>
    );
  }

  const excluded = breakdown.rows.filter((row) => !row.deductible);
  const excludedTotal = excluded.reduce((sum, row) => sum + row.amount, 0);

  return (
    <section
      aria-label="Deduction breakdown"
      className="overflow-hidden rounded-2xl border border-border/50 border-t-[3px] border-t-indigo-500/60 bg-card shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/50 px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">How the deduction line is built</h2>
          <p className="mt-0.5 max-w-3xl text-xs text-muted-foreground">
            Everything the disbursement ledger carried in {year}, split by the account type each line was booked to.
            Only cost of goods sold, cost of services, operating expense and finance cost reach the return.
          </p>
        </div>
        <Badge variant="outline" className="tabular-nums text-[11px]">
          {formatNumber(breakdown.rows.length)} account {breakdown.rows.length === 1 ? "type" : "types"}
        </Badge>
      </div>

      <div className="grid gap-4 border-b border-border/50 px-4 py-3 sm:grid-cols-3">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Total disbursed</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums">{formatCurrency(breakdown.total)}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Deductible, line 6</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
            {formatCurrency(breakdown.deductible)}
          </p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Not a deduction</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-muted-foreground">{formatCurrency(excludedTotal)}</p>
        </div>
      </div>

      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
          <tr>
            <th scope="col" className="py-2 pl-5 pr-4 text-left font-medium">
              Account type
            </th>
            <th scope="col" className="px-4 py-2 text-right font-medium">
              Amount
            </th>
            <th scope="col" className="py-2 pl-4 pr-5 text-right font-medium">
              On the return
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {breakdown.rows.map((row) => (
            <tr key={row.type || "unclassified"} className={row.deductible ? undefined : "text-muted-foreground"}>
              <th scope="row" className="py-2 pl-5 pr-4 text-left font-normal">
                {row.label}
              </th>
              <td className="px-4 py-2 text-right tabular-nums">{formatCurrency(row.amount)}</td>
              <td className="py-2 pl-4 pr-5 text-right">
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
                    row.deductible
                      ? "bg-emerald-500/10 text-emerald-700 ring-emerald-500/25 dark:text-emerald-300"
                      : "bg-muted text-muted-foreground ring-border/60",
                  )}
                >
                  {row.deductible ? "Deductible" : "Balance-sheet movement"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {breakdown.accounts.length > 0 ? (
        <div className="border-t border-border/50 bg-muted/20 px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Largest deductible accounts</p>
          <ul className="mt-1.5 grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
            {breakdown.accounts.map((account) => (
              <li key={account.title} className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate" title={account.title}>
                  {account.title}
                </span>
                <span className="shrink-0 tabular-nums">{formatCurrency(account.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
