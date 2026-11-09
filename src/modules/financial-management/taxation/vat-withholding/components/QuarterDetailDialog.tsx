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
import type { QuarterFigures, VatComputation } from "../types";
import { carryOut } from "../vatMath";

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
 * How one quarter's VAT payable was built.
 *
 * Zero-rated sales are not captured by this system, so they read "Not recorded" here
 * instead of a 0.00 that would look like a filed figure.
 */
export function QuarterDetailDialog({
  quarter,
  index,
  figures,
  vat,
  open,
  onOpenChange,
}: {
  quarter: string;
  index: number;
  figures: QuarterFigures | undefined;
  vat: VatComputation;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const money = (value: number | undefined) => (value == null ? "not available" : formatCurrency(value));
  const carried = carryOut(vat)[index];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="w-[95vw] rounded-2xl p-0 sm:max-w-[640px]">
        <div className="flex max-h-[85vh] flex-col overflow-hidden">
          <DialogHeader className="border-b px-6 py-4">
            <DialogTitle className="text-base">{quarter} VAT build-up</DialogTitle>
            <DialogDescription className="text-xs">Output VAT less input VAT, plus any credit carried in.</DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
            <dl className="grid grid-cols-1 gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
              <Field label="Net sales" value={money(figures?.sales)} />
              <Field label="Zero-rated sales" value="Not recorded" muted />
              <Field label="Group sales" value={money(figures?.icSales)} />
              <Field label="VAT purchases" value={money(figures?.purchasesVat)} />
              <Field label="Output VAT" value={money(vat.outputVat[index])} />
              <Field label="Input VAT" value={money(vat.inputVat[index])} />
              <Field label="Carried in" value={money(vat.carriedIn[index])} />
              <Field label="Withheld (creditable)" value={money(figures?.cwt)} />
              <Field label="Payable" value={money(vat.payable[index])} />
              <Field label="Carried to next quarter" value={money(carried)} />
            </dl>

            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Inputs from the company&apos;s books
              </h3>
              <div className="overflow-hidden rounded-lg border">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                      <th scope="col" className="px-3 py-2 font-semibold">Item</th>
                      <th scope="col" className="px-3 py-2 text-right font-semibold">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: "Sales (net of VAT)", value: figures?.sales },
                      { label: "Sales VAT", value: figures?.salesVat },
                      { label: "Sales returns", value: figures?.returns },
                      { label: "Returns VAT", value: figures?.returnsVat },
                      { label: "Purchases (net of VAT)", value: figures?.purchases },
                      { label: "Purchase VAT", value: figures?.purchasesVat },
                      { label: "Expenses", value: figures?.expenses },
                      { label: "Creditable withholding tax", value: figures?.cwt },
                      { label: "Group sales", value: figures?.icSales },
                      { label: "Group purchases", value: figures?.icPurchases },
                    ].map((row) => (
                      <tr key={row.label} className="border-b last:border-0">
                        <td className="px-3 py-2">{row.label}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{money(row.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
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
