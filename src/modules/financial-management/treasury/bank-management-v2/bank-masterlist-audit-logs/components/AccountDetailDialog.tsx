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

import { statusLabel, statusTone, toneClass } from "../constants";
import { toPhtDateString } from "../pht";
import type { BankAccountV2 } from "../types";

type Props = {
  account: BankAccountV2 | null;
  onOpenChange: (open: boolean) => void;
};

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words">{children}</dd>
    </div>
  );
}

/** Everything the masterlist row carries, plus the parts of the row that were truncated. */
export function AccountDetailDialog({ account, onOpenChange }: Props) {
  return (
    <Dialog open={account !== null} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="w-[95vw] rounded-2xl p-0 sm:max-w-[720px]">
        {account ? (
          <div className="flex max-h-[85vh] flex-col overflow-hidden">
            <DialogHeader className="border-b px-6 py-4">
              <DialogTitle className="line-clamp-1">{account.bankName}</DialogTitle>
              <DialogDescription className="line-clamp-2 max-w-md">
                BA-{account.bankId} · {account.accountNumber}
                {account.branch ? ` · ${account.branch}` : ""}
              </DialogDescription>
            </DialogHeader>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
              <dl className="grid grid-cols-1 gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
                <Detail label="Status">
                  <Badge variant="outline" className={toneClass(statusTone(account.status))}>
                    {statusLabel(account.status)}
                  </Badge>
                </Detail>
                <Detail label="Account number">{account.accountNumber}</Detail>
                <Detail label="Account holder">{account.accountName ?? "—"}</Detail>
                <Detail label="Account type">{account.accountType ?? "—"}</Detail>
                <Detail label="Branch">{account.branch ?? "—"}</Detail>
                <Detail label="Currency">{account.currency}</Detail>
                <Detail label="IFRS 9 category">{account.ifrsCategory}</Detail>
                <Detail label="Linked GL">
                  {account.glCode ? (
                    <>
                      {account.glCode}
                      {account.glTitle ? <span className="text-muted-foreground"> · {account.glTitle}</span> : null}
                    </>
                  ) : (
                    <span className="text-muted-foreground">Not configured</span>
                  )}
                </Detail>
                <Detail label="Opening balance">
                  <span className="tabular-nums">{formatCurrency(account.openingBalance)}</span>
                </Detail>
                <Detail label="Book balance">
                  <span className="tabular-nums font-medium">{formatCurrency(account.bookBalance)}</span>
                </Detail>
                <Detail label="Effective date">
                  {account.effectiveDate ? toPhtDateString(account.effectiveDate) : "—"}
                </Detail>
                <Detail label="Onboarded (PHT)">
                  {account.createdAt ? toPhtDateString(account.createdAt) : "—"}
                </Detail>
                <Detail label="Last reconciled (PHT)">
                  {account.lastReconciledAt ? toPhtDateString(account.lastReconciledAt) : "Never reconciled"}
                </Detail>
              </dl>

              <p className="mt-4 border-t border-border/50 pt-3 text-xs text-muted-foreground">
                Book balance is the opening balance plus cash deposits minus disbursements. Checks still in clearing
                sit in GL 232100, so they are not counted here until the bank pays or credits them.
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
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
