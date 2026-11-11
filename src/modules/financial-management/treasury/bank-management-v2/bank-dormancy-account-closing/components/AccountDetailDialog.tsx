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
import { ESCHEAT_MONTHS, classLabel, classTone, statusLabel, statusTone, toneClass } from "../constants";
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
  isSaving: boolean;
  onReclassify: (account: DormancyAccount) => void;
  onEscheat: (account: DormancyAccount) => void;
  onDeactivate: (account: DormancyAccount) => void;
};

/**
 * Mirrors the gates in `escheat()`: dormant, escheat-eligible and still holding a balance. The
 * button stays visible and greyed with this reason so the reader can see what the step waits for.
 */
function escheatBlockedReason(account: DormancyAccount): string | null {
  if (account.status === "INACTIVE") {
    return "A deactivated account is frozen. Reactivate it in the register first.";
  }
  if (account.status !== "DORMANT") {
    return `Only a dormant account can be escheated; this one is ${statusLabel(account.status).toLowerCase()}.`;
  }
  if (account.classification !== "ESCHEAT_ELIGIBLE") {
    return `Needs ${ESCHEAT_MONTHS} months dormant; this account is at ${account.monthsInactive}.`;
  }
  if (account.bookBalance <= 0) {
    return "There is no dormant balance to escheat.";
  }
  return null;
}

/** Read-only detail behind a scan row, with the lifecycle actions the row no longer carries. */
export function AccountDetailDialog({ account, onOpenChange, isSaving, onReclassify, onEscheat, onDeactivate }: Props) {
  const frozen = account ? account.status === "CLOSED" || account.status === "ESCHEATED" : false;
  const escheatBlocked = account ? escheatBlockedReason(account) : null;
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
                    {statusLabel(account.status)}
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

              {account.status === "ESCHEATED" && (
                <p className="rounded-lg border border-border/50 bg-muted/30 px-3 py-2 text-xs">
                  Frozen: the balance was escheated to the National Treasury under Act No. 3936. The account cannot
                  transact and is not an ordinary customer closure.
                </p>
              )}
              {account.status === "INACTIVE" && (
                <p className="rounded-lg border border-border/50 bg-muted/30 px-3 py-2 text-xs">
                  Frozen: the account was deactivated. It cannot receive deposits, checks or transfers until an
                  administrator reactivates it.
                </p>
              )}

              <p className="text-xs text-muted-foreground">
                Customer activity counts deposits, transfers, released and issued checks. Bank-initiated memos and
                interest never reset the dormancy clock.
              </p>
            </div>

            <DialogFooter className="flex-col items-stretch gap-2 border-t bg-muted/20 px-6 py-4 sm:flex-col sm:justify-end">
              <div className="flex flex-wrap items-center justify-end gap-2">
                {!frozen && (
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={isSaving || Boolean(escheatBlocked)}
                    title={escheatBlocked ?? undefined}
                    aria-describedby={escheatBlocked ? "escheat-blocked" : undefined}
                    onClick={() => onEscheat(account)}
                  >
                    Escheat (Act 3936)
                  </Button>
                )}
                {!frozen && (account.status === "ACTIVE" || account.status === "DORMANT") && (
                  <Button size="sm" variant="outline" disabled={isSaving} onClick={() => onDeactivate(account)}>
                    Deactivate account
                  </Button>
                )}
                {!frozen && account.status === "ACTIVE" && account.classification === "DORMANT_ELIGIBLE" && (
                  <Button size="sm" variant="outline" disabled={isSaving} onClick={() => onReclassify(account)}>
                    Reclassify to 201800
                  </Button>
                )}
                <DialogClose asChild>
                  <Button variant="outline">Close</Button>
                </DialogClose>
              </div>
              {frozen ? (
                <p className="text-right text-xs text-muted-foreground">
                  This account is frozen, so no lifecycle action is available.
                </p>
              ) : (
                escheatBlocked && (
                  <p id="escheat-blocked" className="text-right text-xs text-muted-foreground">
                    Escheat unavailable: {escheatBlocked}
                  </p>
                )
              )}
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
