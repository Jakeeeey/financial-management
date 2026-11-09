"use client";

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
import { REGIME_SHORT, netPositionClass } from "../constants";
import type { GroupCompanyRow } from "../types";
import { StatusBadge } from "./StatusBadge";

function Field({
  label,
  value,
  className,
  title,
}: {
  label: string;
  value: string;
  className?: string;
  title?: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={cn("mt-0.5 truncate font-medium tabular-nums", className)} title={title ?? value}>
        {value}
      </dd>
    </div>
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
  const moneyClass = unreadable ? "text-muted-foreground" : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="w-[95vw] rounded-2xl p-0 sm:max-w-[760px]">
        <div className="flex max-h-[85vh] flex-col overflow-hidden">
          <DialogHeader className="border-b px-6 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <DialogTitle className="truncate text-base" title={row.name}>
                  {row.name}
                </DialogTitle>
                <DialogDescription className="truncate font-mono text-xs">{row.code}</DialogDescription>
              </div>
              <StatusBadge status={row.status} className="shrink-0" />
            </div>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
            <dl className="grid grid-cols-1 gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
              <Field label="Income tax due" value={money(row.taxDue)} className={moneyClass} />
              <Field label="Tax credits" value={money(row.credits)} className={moneyClass} />
              <Field
                label="Net position"
                value={money(row.netPosition)}
                className={unreadable ? "text-muted-foreground" : netPositionClass(row.netPosition)}
              />
              <Field label="VAT payable" value={money(row.vatPayable)} className={moneyClass} />
              <Field label="Withholding withheld" value={money(row.withholding)} className={moneyClass} />
              <Field label="Gross income" value={money(row.grossIncome)} className={moneyClass} />
              <Field label="Net taxable income" value={money(row.netTaxableIncome)} className={moneyClass} />
              <Field
                label="Regime"
                value={row.regime ? (REGIME_SHORT[row.regime] ?? row.regime) : "Not on file"}
                className={row.regime ? undefined : "text-muted-foreground"}
              />
              <Field
                label="Needs attention"
                value={attentionCount === 0 ? "None" : `${attentionCount} ${attentionCount === 1 ? "item" : "items"}`}
                className={attentionCount === 0 ? undefined : "text-amber-700 dark:text-amber-400"}
              />
              <Field
                label="Reachability"
                value={row.reachable ? "Instance reachable" : "Instance not reachable"}
                className={row.reachable ? undefined : "text-destructive"}
              />
            </dl>

            {unreadable ? (
              <p className="text-xs text-muted-foreground" title={row.failure ?? undefined}>
                Figures cannot be read from this instance.
              </p>
            ) : null}
            {row.profileMissing && !unreadable ? (
              <p className="text-xs text-muted-foreground">
                No tax profile is stored; these figures use the fallback rates.
              </p>
            ) : null}
          </div>

          <DialogFooter className="border-t bg-muted/20 px-6 py-4">
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
