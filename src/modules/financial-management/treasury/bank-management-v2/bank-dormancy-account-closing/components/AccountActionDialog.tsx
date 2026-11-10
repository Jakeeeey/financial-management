"use client";

import { Loader2 } from "lucide-react";

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
import type { DormancyAccount } from "../types";

export type AccountAction = "RECLASSIFY" | "ESCHEAT";

type Props = {
  account: DormancyAccount | null;
  action: AccountAction | null;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (account: DormancyAccount, action: AccountAction) => void;
};

const COPY: Record<AccountAction, { title: string; body: string; confirm: string }> = {
  RECLASSIFY: {
    title: "Reclassify to GL 201800",
    body: "The remaining deposit liability moves out of the active deposit account into dormant deposit liabilities. The account becomes Dormant, leaves every active dropdown, and is never released to profit or loss (IAS 32).",
    confirm: "Reclassify account",
  },
  ESCHEAT: {
    title: "Escheat under Act No. 3936",
    body: "A deposit dormant for ten years belongs to the National Treasury. The dormant liability moves to the statutory escheatment payable and the account is closed permanently.",
    confirm: "Escheat balance",
  },
};

export function AccountActionDialog({ account, action, isSaving, onOpenChange, onConfirm }: Props) {
  const open = Boolean(account && action);
  const copy = action ? COPY[action] : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="w-[95vw] rounded-2xl p-0 sm:max-w-[550px]">
        {account && action && copy && (
          <div className="flex max-h-[85vh] flex-col overflow-hidden">
            <DialogHeader className="border-b px-6 py-4">
              <DialogTitle className="line-clamp-1">{copy.title}</DialogTitle>
              <DialogDescription className="line-clamp-2 max-w-md">
                {account.bankName} {account.accountNumber}
              </DialogDescription>
            </DialogHeader>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4 text-sm">
              <p className="text-muted-foreground">{copy.body}</p>
              <dl className="grid grid-cols-2 gap-3">
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Book balance
                  </dt>
                  <dd className="tabular-nums">{formatCurrency(account.bookBalance)}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Event</dt>
                  <dd>
                    <Badge variant="outline" className="text-[11px]">
                      {action === "RECLASSIFY" ? "E16" : "E17"}
                    </Badge>
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Posting
                  </dt>
                  <dd className="text-muted-foreground">
                    {action === "RECLASSIFY"
                      ? "Dr active deposit liability · Cr dormant deposit liabilities (201800)"
                      : "Dr dormant deposit liabilities (201800) · Cr statutory escheatment payable (232300)"}
                  </dd>
                </div>
              </dl>
            </div>

            <DialogFooter className="border-t bg-muted/20 px-6 py-4">
              <DialogClose asChild>
                <Button variant="outline" disabled={isSaving}>
                  Cancel
                </Button>
              </DialogClose>
              <Button
                variant={action === "ESCHEAT" ? "destructive" : "default"}
                disabled={isSaving}
                onClick={() => onConfirm(account, action)}
              >
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
                {copy.confirm}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
