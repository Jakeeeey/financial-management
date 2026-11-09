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
import { formatCurrency } from "@/lib/utils";
import type { MonthlyWithholdingRow } from "../types";

function Field({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={muted ? "mt-0.5 truncate text-muted-foreground" : "mt-0.5 truncate font-medium tabular-nums"} title={value}>
        {value}
      </dd>
    </div>
  );
}

/**
 * One month of purchase-order withholding.
 *
 * The rows behind the month are not kept in this system, so the dialog states the month's
 * totals and says the per-supplier split is not stored rather than fabricating one.
 */
export function MonthDetailDialog({
  row,
  open,
  onOpenChange,
}: {
  row: MonthlyWithholdingRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!row) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="w-[95vw] rounded-2xl p-0 sm:max-w-[640px]">
        <div className="flex max-h-[85vh] flex-col overflow-hidden">
          <DialogHeader className="border-b px-6 py-4">
            <DialogTitle className="text-base">{row.label}</DialogTitle>
            <DialogDescription className="text-xs">
              {row.quarter} · {row.quarterEnd ? "quarter-end month" : "filed monthly"}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
            <dl className="grid grid-cols-1 gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
              <Field label="Purchases subject to withholding" value={formatCurrency(row.purchases)} />
              <Field label="Tax withheld" value={formatCurrency(row.withheld)} />
              <Field
                label="On 0619-E (month)"
                value={row.agentDue == null ? "Quarter-end month" : formatCurrency(row.agentDue)}
                muted={row.agentDue == null}
              />
              <Field
                label="On 1601-EQ (quarter)"
                value={row.quarterlyDue == null ? "Not a quarter end" : formatCurrency(row.quarterlyDue)}
                muted={row.quarterlyDue == null}
              />
            </dl>

            <p className="text-xs text-muted-foreground">
              Per-supplier split is not stored in this system; the month is summed from purchase orders.
            </p>
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
