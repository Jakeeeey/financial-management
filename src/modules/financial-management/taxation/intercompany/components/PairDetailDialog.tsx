"use client";

import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn, formatCurrency } from "@/lib/utils";

import { ASSUMED_WITHHOLDING_LABEL, formatMonth, toneClass } from "../constants";
import type { IntercompanyMonthlyRow, IntercompanyPair } from "../types";
import { AMOUNT_TOLERANCE, buildWithholdingRows, VERDICT_STYLE } from "../withholding";
import { PairStatusBadge } from "./PairStatusBadge";

type Props = {
  pair: IntercompanyPair | null;
  /** The selected company's monthly rows; the only month detail the payload carries. */
  monthly: IntercompanyMonthlyRow[];
  companyCode: string;
  onOpenChange: (open: boolean) => void;
};

interface PairMonth {
  month: string;
  sales: number | null;
  purchases: number | null;
  withheld: number;
}

/**
 * The seller's invoices and the buyer's orders are reported per company, so a pair's own month
 * series exists only when the selected company is one of its two sides. The absent side stays
 * blank rather than being filled from the other direction of the same pair.
 */
function pairMonths(pair: IntercompanyPair, monthly: IntercompanyMonthlyRow[], companyCode: string): PairMonth[] {
  const buckets = new Map<string, PairMonth>();
  for (const row of monthly) {
    const isSale = companyCode === pair.fromCode && row.direction === "SALE" && row.counterpartyCode === pair.toCode;
    const isPurchase =
      companyCode === pair.toCode && row.direction === "PURCHASE" && row.counterpartyCode === pair.fromCode;
    if (!isSale && !isPurchase) continue;

    const bucket = buckets.get(row.month) ?? { month: row.month, sales: null, purchases: null, withheld: 0 };
    if (isSale) bucket.sales = row.amount;
    else bucket.purchases = row.amount;
    bucket.withheld += row.withheld;
    buckets.set(row.month, bucket);
  }
  return [...buckets.values()].sort((left, right) => left.month.localeCompare(right.month));
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words">{children}</dd>
    </div>
  );
}

function money(value: number | null): string {
  return value === null ? "—" : formatCurrency(value);
}

export function PairDetailDialog({ pair, monthly, companyCode, onOpenChange }: Props) {
  const row = pair ? buildWithholdingRows([pair])[0] : null;
  const months = pair ? pairMonths(pair, monthly, companyCode) : [];
  const partial = months.some((month) => month.sales === null) && months.some((month) => month.purchases === null);

  return (
    <Dialog open={pair !== null} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] rounded-2xl p-0 sm:max-w-[720px]">
        {pair && row ? (
          <div className="flex max-h-[85vh] flex-col overflow-hidden">
            <DialogHeader className="border-b px-6 py-4">
              <DialogTitle className="tabular-nums">
                {pair.fromCode} → {pair.toCode}
              </DialogTitle>
              <DialogDescription className="line-clamp-2">
                {pair.fromName} → {pair.toName}
              </DialogDescription>
            </DialogHeader>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
              <dl className="grid grid-cols-1 gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
                <Detail label="Seller">{pair.fromName}</Detail>
                <Detail label="Buyer">{pair.toName}</Detail>
                <Detail label="Sales this year">
                  <span className="tabular-nums">{formatCurrency(pair.amount)}</span>
                  <span className="ml-1 text-xs text-muted-foreground">
                    · {pair.invoices} invoice{pair.invoices === 1 ? "" : "s"}
                  </span>
                </Detail>
                <Detail label="Purchases this year">
                  <span className="tabular-nums">{money(pair.reciprocalAmount)}</span>
                  <span className="ml-1 text-xs text-muted-foreground">
                    · {pair.reciprocalInvoices} order{pair.reciprocalInvoices === 1 ? "" : "s"}
                  </span>
                </Detail>
                <Detail label="VAT">
                  <span className="tabular-nums">{formatCurrency(pair.vat)}</span>
                </Detail>
                <Detail label="Rate">
                  {row.rate === null ? (
                    <span className="text-xs font-medium text-muted-foreground">not determinable</span>
                  ) : (
                    <>
                      <span className="font-medium tabular-nums">{Math.round(row.rate * 100)}%</span>
                      <span className="ml-1 text-xs text-muted-foreground">{ASSUMED_WITHHOLDING_LABEL}</span>
                    </>
                  )}
                </Detail>
                <Detail label="Withheld on invoices">
                  <span className="tabular-nums">{formatCurrency(pair.withheld)}</span>
                </Detail>
                <Detail label="Expected at the doc rate">
                  <span className="tabular-nums">{money(row.expected)}</span>
                </Detail>
                <Detail label="Recorded by payer">
                  <span className="tabular-nums">{money(row.recorded)}</span>
                  <span className="ml-1 text-xs text-muted-foreground">
                    {row.recordedSource === "purchase_order"
                      ? "from the buyer's order"
                      : row.recordedSource === "sales_invoice"
                        ? "from the seller's invoice"
                        : "nothing recorded"}
                  </span>
                </Detail>
                <Detail label="Difference">
                  <span
                    className={cn(
                      "tabular-nums",
                      row.difference !== null && Math.abs(row.difference) > AMOUNT_TOLERANCE
                        ? "text-amber-700 dark:text-amber-400"
                        : undefined,
                    )}
                  >
                    {money(row.difference)}
                  </span>
                </Detail>
                <Detail label="Verdict">
                  <Badge variant="outline" className={cn("text-[11px] font-medium", toneClass(VERDICT_STYLE[row.verdict].tone))}>
                    {VERDICT_STYLE[row.verdict].label}
                  </Badge>
                </Detail>
                <Detail label="Pair status">
                  <PairStatusBadge pair={pair} />
                </Detail>
              </dl>

              {months.length > 0 ? (
                <section className="space-y-2">
                  <h3 className="text-sm font-semibold">Months</h3>
                  <div className="overflow-x-auto rounded-xl border border-border/50">
                    <Table aria-label={`Months for ${pair.fromCode} to ${pair.toCode}`}>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Month</TableHead>
                          <TableHead className="text-right">Sales</TableHead>
                          <TableHead className="text-right">Purchases</TableHead>
                          <TableHead className="text-right">Withheld</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {months.map((month) => (
                          <TableRow key={month.month}>
                            <TableCell className="tabular-nums">{formatMonth(month.month)}</TableCell>
                            <TableCell className="text-right tabular-nums">{money(month.sales)}</TableCell>
                            <TableCell className="text-right tabular-nums">{money(month.purchases)}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatCurrency(month.withheld)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {partial ? (
                    <p className="text-xs text-muted-foreground">
                      Monthly figures cover {companyCode}&apos;s side of this pair only.
                    </p>
                  ) : null}
                </section>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No month detail: {companyCode} is not a side of this pair.
                </p>
              )}
            </div>

            <DialogFooter className="border-t bg-muted/20 px-6 py-4">
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Close
                </Button>
              </DialogClose>
            </DialogFooter>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

