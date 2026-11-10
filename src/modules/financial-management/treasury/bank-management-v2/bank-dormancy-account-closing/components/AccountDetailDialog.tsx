"use client";

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
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/utils";
import { classLabel, classTone, statusTone, toneClass } from "../constants";
import { phtDisplayStamp } from "../pht";
import type { DormancyAccount } from "../types";

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children ?? "—"}</dd>
    </div>
  );
}

function stamp(value: string | null): string {
  return value ? phtDisplayStamp(value) : "—";
}

type Props = {
  account: DormancyAccount | null;
  onOpenChange: (open: boolean) => void;
};

/** Read-only detail behind a scan row: the lifecycle dates the table cannot show. */
export function AccountDetailDialog({ account, onOpenChange }: Props) {
  return (
    <Dialog open={Boolean(account)} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="w-[95vw] rounded-2xl p-0 sm:max-w-[720px]">
        {account && (
          <div className="flex max-h-[85vh] flex-col overflow-hidden">
            <DialogHeader className="border-b px-6 py-4">
              <DialogTitle className="line-clamp-1">
                {account.bankName} {account.accountNumber}
              </DialogTitle>
              <DialogDescription className="line-clamp-2 max-w-md">
                {account.accountName ?? "No account holder"} · {account.accountType ?? "No account type"}
              </DialogDescription>
            </DialogHeader>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4 text-sm">
              <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
                <Detail label="Status">
                  <Badge variant="outline" className={`text-[11px] font-semibold ${toneClass(statusTone(account.status))}`}>
                    {account.status}
                  </Badge>
                </Detail>
                <Detail label="Classification">
                  <Badge
                    variant="outline"
                    className={`text-[11px] font-semibold ${toneClass(classTone(account.classification))}`}
                  >
                    {classLabel(account.classification)}
                  </Badge>
                </Detail>
                <Detail label="Branch">{account.branch ?? "—"}</Detail>
                <Detail label="Currency">{account.currency}</Detail>
                <Detail label="Book balance">
                  <span className="tabular-nums">{formatCurrency(account.bookBalance)}</span>
                </Detail>
                <Detail label="Months inactive">
                  <span className="tabular-nums">{account.monthsInactive}</span>
                </Detail>
                <Detail label="Last customer activity">
                  {account.lastCustomerActivity ?? "None recorded"}
                  {account.lastActivitySource ? (
                    <span className="block text-xs text-muted-foreground">{account.lastActivitySource}</span>
                  ) : null}
                </Detail>
                <Detail label="Linked GL">
                  {account.glCode ? `${account.glCode} · ${account.glTitle ?? ""}` : "Not configured"}
                </Detail>
              </dl>

              <Separator />

              <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
                <Detail label="Dormant since">{stamp(account.dormantSince)}</Detail>
                <Detail label="Escheated at">{stamp(account.escheatedAt)}</Detail>
                <Detail label="Closed at">{stamp(account.closedAt)}</Detail>
                <Detail label="Retained until">{account.retainUntil ?? "—"}</Detail>
                <Detail label="Closure reason">
          <span className="break-words">{account.closureReason ?? "—"}</span>
        </Detail>
              </dl>

              <p className="text-xs text-muted-foreground">
                Customer activity counts deposits, transfers, released and issued checks. Bank-initiated memos and
                interest never reset the dormancy clock.
              </p>
            </div>

            <DialogFooter className="border-t bg-muted/20 px-6 py-4">
              <DialogClose asChild>
                <Button variant="outline">Close</Button>
              </DialogClose>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
