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
import { formatCurrency } from "@/lib/utils";

import { TRANSACTION_KIND_LABELS } from "../constants";
import { phtToday, toPhtDateString } from "../pht";
import type { TransactionRow } from "../types";
import { StatusBadge } from "./StatusBadge";

type Props = {
  row: TransactionRow | null;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onSettle: (row: TransactionRow) => void;
  onCancelMemo: (row: TransactionRow) => void;
};

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words">{children}</dd>
    </div>
  );
}

/** Shared by the register and the transfers-in-clearing tab: both render TransactionRow. */
export function TransactionDetailDialog({ row, isSaving, onOpenChange, onSettle, onCancelMemo }: Props) {
  const isTransfer = row?.kind === "TRANSFER";
  const canSettle = Boolean(
    row && isTransfer && row.status === "PENDING" && row.valueDate <= phtToday(),
  );
  const canCancel = Boolean(row && !isTransfer && row.status === "POSTED");
  const net = row ? (row.direction === "IN" ? row.amount : row.amount + row.fee) : 0;

  return (
    <Dialog open={row !== null} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="w-[95vw] rounded-2xl p-0 sm:max-w-[720px]">
        {row ? (
          <div className="flex max-h-[85vh] flex-col overflow-hidden">
            <DialogHeader className="border-b px-6 py-4">
              <DialogTitle className="line-clamp-1">{row.refNo}</DialogTitle>
              <DialogDescription className="line-clamp-2 max-w-md">
                {TRANSACTION_KIND_LABELS[row.kind]} · {row.accountLabel}
              </DialogDescription>
            </DialogHeader>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
              <dl className="grid grid-cols-1 gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
                <Detail label="Status">
                  <StatusBadge status={row.status} />
                </Detail>
                <Detail label="Type">
                  <Badge variant="outline">{TRANSACTION_KIND_LABELS[row.kind]}</Badge>
                </Detail>
                <Detail label="Transaction date (PHT)">{toPhtDateString(row.date)}</Detail>
                <Detail label="Value date (PHT)">{toPhtDateString(row.valueDate)}</Detail>
                <Detail label="Bank account">{row.accountLabel}</Detail>
                <Detail label={isTransfer ? "Receiving account" : "Payee / customer"}>
                  {row.counterpartLabel ?? "—"}
                </Detail>
                <Detail label="Amount">
                  <span className="tabular-nums">{formatCurrency(row.amount)}</span>
                </Detail>
                <Detail label="Transfer fee">
                  <span className="tabular-nums">{row.fee ? formatCurrency(row.fee) : "—"}</span>
                </Detail>
                <Detail label={row.direction === "IN" ? "Addition to the account" : "Deduction from the account"}>
                  <span className="tabular-nums font-medium">
                    {row.direction === "IN" ? "+" : "−"}
                    {formatCurrency(net)}
                  </span>
                </Detail>
                <Detail label="Journal entry">
                  {row.jeNo ? <span className="font-mono text-xs">{row.jeNo}</span> : <span className="text-muted-foreground">Not posted</span>}
                </Detail>
                <Detail label="Description">{row.description ?? "—"}</Detail>
              </dl>

              {isTransfer && row.status === "PENDING" ? (
                <p className="mt-4 border-t border-border/50 pt-3 text-xs text-muted-foreground">
                  The sending side is posted and the value sits in GL 232100 until the value date. Settling leg 2
                  credits the receiving account and clears the in-transit balance.
                </p>
              ) : null}
            </div>

            <DialogFooter className="border-t bg-muted/20 px-6 py-4">
              {canCancel ? (
                <Button type="button" variant="outline" disabled={isSaving} onClick={() => onCancelMemo(row)}>
                  Cancel memo
                </Button>
              ) : null}
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Close
                </Button>
              </DialogClose>
              {canSettle ? (
                <Button type="button" disabled={isSaving} onClick={() => onSettle(row)}>
                  Settle leg 2
                </Button>
              ) : null}
            </DialogFooter>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
