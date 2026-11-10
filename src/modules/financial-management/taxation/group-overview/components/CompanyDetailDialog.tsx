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
import { cn, formatCurrency } from "@/lib/utils";
import { REGIME_SHORT, accentClass, edgeClass, netPositionClass, statusTone } from "../constants";
import type { GroupCompanyRow } from "../types";
import { StatusBadge } from "./StatusBadge";

const SOURCE_NOTE: Record<GroupCompanyRow["source"], string> = {
  STT_VIEW: "Sales read from the itemized sales view, the same source the sales report sums.",
  INVOICE_LINES: "Sales read from the invoice register line by line; the sales view was not available.",
  INVOICE_HEADERS: "Sales read from invoice headers, without the Spring session that reads the sales view.",
};

function Row({
  label,
  value,
  className,
  title,
  emphasis,
}: {
  label: string;
  value: string;
  className?: string;
  title?: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-4 py-1.5",
        emphasis && "border-t border-border/60 pt-2.5",
      )}
    >
      <dt className={cn("min-w-0 text-sm", emphasis ? "font-medium" : "text-muted-foreground")}>{label}</dt>
      <dd
        className={cn("shrink-0 text-right font-medium tabular-nums", emphasis && "text-base", className)}
        title={title ?? value}
      >
        {value}
      </dd>
    </div>
  );
}

function Card({
  title,
  hint,
  children,
  className,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("overflow-hidden rounded-xl border border-border/60 bg-card", className)}>
      <div className="border-b border-border/60 bg-muted/30 px-4 py-2">
        <h3 className="text-xs font-semibold">{title}</h3>
        {hint ? <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p> : null}
      </div>
      <dl className="divide-y divide-border/40 px-4 py-1.5">{children}</dl>
    </section>
  );
}

/**
 * One company's year, opened from its row.
 *
 * An unreadable instance reports "not available" rather than the zeros its row carries,
 * so the dialog never states a figure the company did not return.
 */
export function CompanyDetailDialog({
  row,
  attentionCount,
  open,
  onOpenChange,
}: {
  row: GroupCompanyRow | null;
  attentionCount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!row) return null;

  const unreadable = row.status === "UNREADABLE";
  const money = (value: number) => (unreadable ? "not available" : formatCurrency(value));
  const muted = unreadable ? "text-muted-foreground" : undefined;
  const position = row.netPosition > 0 ? "still payable" : row.netPosition < 0 ? "overpaid" : "settled";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "w-[95vw] overflow-hidden rounded-2xl border-t-[3px] p-0 sm:max-w-[860px]",
          edgeClass(statusTone(row.status)),
        )}
      >
        <div className="flex max-h-[88vh] flex-col">
          <DialogHeader
            className={cn(
              "space-y-0 border-b bg-gradient-to-r to-transparent px-6 py-5",
              accentClass(statusTone(row.status)),
            )}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <DialogTitle className="truncate text-base" title={row.name}>
                  {row.name}
                </DialogTitle>
                <DialogDescription className="mt-0.5 flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-mono">{row.code}</span>
                  <span aria-hidden="true">·</span>
                  <span>{row.regime ? (REGIME_SHORT[row.regime] ?? row.regime) : "Regime not on file"}</span>
                </DialogDescription>
              </div>
              <StatusBadge status={row.status} className="shrink-0" />
            </div>

            <div className="flex flex-wrap items-end gap-x-8 gap-y-2 pt-4">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Net position · {position}</p>
                <p
                  className={cn(
                    "text-3xl font-semibold leading-tight tabular-nums",
                    unreadable ? "text-muted-foreground" : netPositionClass(row.netPosition),
                  )}
                >
                  {money(row.netPosition)}
                </p>
              </div>
              <div className="flex gap-6 pb-1">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Tax due</p>
                  <p className={cn("text-sm font-medium tabular-nums", muted)}>{money(row.taxDue)}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Credits</p>
                  <p className={cn("text-sm font-medium tabular-nums", muted)}>{money(row.credits)}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">VAT payable</p>
                  <p className={cn("text-sm font-medium tabular-nums", muted)}>{money(row.vatPayable)}</p>
                </div>
              </div>
            </div>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                {
                  label: "Total charged to customers",
                  value: row.sales + row.salesVat,
                  dot: "bg-blue-500",
                  hint: "Sales plus the VAT on them",
                },
                {
                  label: "Sales, net of VAT",
                  value: row.sales,
                  dot: "bg-violet-500",
                  hint: "The revenue line the tax is computed on",
                },
                {
                  label: "Deductible expenses",
                  value: row.expenses,
                  dot: "bg-emerald-500",
                  hint: "Booked to income-statement accounts",
                },
              ].map((tile) => (
                <div key={tile.label} className="rounded-xl border border-border/60 bg-card px-4 py-3">
                  <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                    <span className={cn("size-1.5 rounded-full", tile.dot)} aria-hidden="true" />
                    {tile.label}
                  </p>
                  <p className={cn("mt-1 text-lg font-semibold tabular-nums", muted)}>{money(tile.value)}</p>
                  <p className="text-[11px] text-muted-foreground">{tile.hint}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card title="Revenue">
                <Row label="Sales, net of VAT" value={money(row.sales)} className={muted} />
                <Row label="VAT on those sales" value={money(row.salesVat)} className={muted} />
                <Row label="Discounts given" value={money(row.discounts)} className={muted} />
                <Row label="Returns and allowances" value={money(row.returns)} className={muted} />
              </Card>

              <Card title="Cost and deductions" hint="What the year cost, by source">
                <Row
                  label="Product standard cost"
                  value={money(row.productCost)}
                  className={muted}
                  title="Line quantity times each product's cost per unit, the cost of sales the worksheet subtracts."
                />
                <Row
                  label="Purchases on purchase orders"
                  value={money(row.purchases)}
                  className={muted}
                  title="What the company bought, not what it sold. Reading it as cost of sales would subtract stock."
                />
                <Row
                  label="Deductible expenses"
                  value={money(row.expenses)}
                  className={muted}
                  title="Payables booked to cost of goods sold, cost of services, operating expense and finance cost accounts."
                />
              </Card>
            </div>

            <Card title="Tax for the year">
              <Row label="Gross income" value={money(row.grossIncome)} className={muted} />
              <Row label="Net taxable income" value={money(row.netTaxableIncome)} className={muted} />
              <Row label="Income tax due" value={money(row.taxDue)} className={muted} />
              <Row label="Less tax credits and prior overpayment" value={money(row.credits)} className={muted} />
              <Row label="Withholding withheld by customers" value={money(row.withholding)} className={muted} />
              <Row
                label="Net position"
                value={money(row.netPosition)}
                className={unreadable ? "text-muted-foreground" : netPositionClass(row.netPosition)}
                emphasis
              />
            </Card>

            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline" className="font-normal">
                {attentionCount === 0
                  ? "No attention items"
                  : `${attentionCount} ${attentionCount === 1 ? "item" : "items"} need attention`}
              </Badge>
              <Badge variant="outline" className="font-normal">
                {row.reachable ? "Instance reachable" : "Instance not reachable"}
              </Badge>
              <span className="min-w-0 truncate" title={SOURCE_NOTE[row.source]}>
                {SOURCE_NOTE[row.source]}
              </span>
            </div>

            {unreadable ? (
              <p className="rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-muted-foreground" title={row.failure ?? undefined}>
                Figures cannot be read from this instance, so nothing here is shown as zero.
              </p>
            ) : null}
            {row.profileMissing && !unreadable ? (
              <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-muted-foreground">
                No tax profile is stored, so these figures use the fallback rates.
              </p>
            ) : null}
          </div>

          <DialogFooter className="border-t bg-muted/20 px-6 py-3">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Close
              </Button>
            </DialogClose>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}


