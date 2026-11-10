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
import { cn, formatCurrency, formatDateTime } from "@/lib/utils";

import { PAYMENT_PERIOD_LABELS } from "../constants";
import type { PaymentRow } from "../types";

function Detail({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-sm">{children}</dd>
    </div>
  );
}

function Missing() {
  return <span className="text-muted-foreground">not recorded</span>;
}

function recordedAt(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : formatDateTime(date);
}

interface Props {
  payment: PaymentRow | null;
  onOpenChange: (open: boolean) => void;
}

/** Read-only view of one payment already recorded for a filed return. */
export function PaymentDetailDialog({ payment, onOpenChange }: Props) {
  return (
    <Dialog open={payment !== null} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] rounded-2xl p-0 sm:max-w-[620px]">
        <div className="flex max-h-[85vh] flex-col overflow-hidden">
          <DialogHeader className="border-b border-border/50 px-6 py-4">
            <DialogTitle className="pr-8 text-base">
              {payment ? `${payment.formCode} payment` : "Payment"}
            </DialogTitle>
            <DialogDescription className="flex flex-wrap items-center gap-2">
              {payment ? (
                <>
                  <span>{PAYMENT_PERIOD_LABELS[payment.periodKey]}</span>
                  <span aria-hidden>·</span>
                  <span className="tabular-nums">{formatCurrency(payment.amount)}</span>
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>

          {payment ? (
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
              <dl className="grid grid-cols-2 gap-4">
                <Detail label="Form">{payment.formCode}</Detail>
                <Detail label="Period">{PAYMENT_PERIOD_LABELS[payment.periodKey]}</Detail>
                <Detail label="Paid on" className="tabular-nums">
                  {payment.paidOn}
                </Detail>
                <Detail label="Amount" className="tabular-nums font-semibold">
                  {formatCurrency(payment.amount)}
                </Detail>
                <Detail label="Reference" className="tabular-nums">
                  {payment.referenceNo ?? <Missing />}
                </Detail>
                <Detail label="Recorded by">
                  {payment.createdByName ?? (payment.createdBy === null ? <Missing /> : `#${payment.createdBy}`)}
                </Detail>
                <Detail label="Recorded at" className="col-span-2 tabular-nums">
                  {recordedAt(payment.createdAt)}
                </Detail>
                {payment.remarks ? (
                  <Detail label="Remarks" className="col-span-2">
                    {payment.remarks}
                  </Detail>
                ) : null}
              </dl>
            </div>
          ) : null}

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

