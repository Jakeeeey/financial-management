"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/utils";

import { phtDisplayStamp, toPhtDateString } from "../pht";
import { StatusBadge } from "./StatusBadge";
import type { DepositSlip } from "../types";

type Props = {
  slip: DepositSlip | null;
  open: boolean;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onCancel: (slipId: number, reason: string) => Promise<boolean>;
};

/**
 * Slip detail with the cancellation control. Cancelling is refused server-side unless
 * every linked check is still in clearing, so the dialog only guards the reason field.
 */
export function SlipDetailDialog({ slip, open, isSaving, onOpenChange, onCancel }: Props) {
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);

  if (!slip) return null;

  const cancellable = slip.status !== "CANCELLED" && slip.status !== "CLEARED";
  const reasonError = reason.trim().length < 5 ? "Give a short reason (at least 5 characters)." : "";

  async function handleCancel() {
    setTouched(true);
    if (reasonError || !slip) return;
    const ok = await onCancel(slip.id, reason.trim());
    if (ok) {
      setReason("");
      setTouched(false);
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-[550px] p-0 rounded-2xl">
        <div className="flex max-h-[85vh] flex-col overflow-hidden">
          <DialogHeader className="border-b px-6 py-4">
            <DialogTitle className="line-clamp-1">{slip.depositNo}</DialogTitle>
            <DialogDescription className="line-clamp-2 max-w-md">
              {toPhtDateString(slip.depositDate)} · {slip.targetBankLabel}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <StatusBadge status={slip.status} className="mt-1" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Prepared</p>
                <p className="truncate" title={slip.preparedBy ?? undefined}>
                  {slip.preparedBy ?? "—"}
                </p>
                <p className="text-xs text-muted-foreground">{phtDisplayStamp(slip.datePrepared)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Cash</p>
                <p className="tabular-nums">{formatCurrency(slip.totalCash)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Checks</p>
                <p className="tabular-nums">{formatCurrency(slip.totalChecks)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="font-medium tabular-nums">{formatCurrency(slip.grandTotal)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Cleared</p>
                <p>{slip.clearedAt ? phtDisplayStamp(slip.clearedAt) : "Not yet"}</p>
              </div>
            </div>

            {slip.remarks && (
              <div>
                <p className="text-xs text-muted-foreground">Remarks</p>
                <p className="max-h-[120px] overflow-y-auto whitespace-pre-wrap break-words text-sm">{slip.remarks}</p>
              </div>
            )}

            {cancellable && (
              <div className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <Label htmlFor="cancel-reason" className="text-sm">
                  Cancellation reason <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="cancel-reason"
                  rows={2}
                  className="min-h-[100px] resize-none"
                  maxLength={300}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Cancelling reverses the cash posting and returns the checks to the vault.
                </p>
                {touched && reasonError && <p className="text-xs text-destructive">{reasonError}</p>}
              </div>
            )}
          </div>

          <DialogFooter className="border-t bg-muted/20 px-6 py-4">
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isSaving}>
                Close
              </Button>
            </DialogClose>
            {cancellable && (
              <Button type="button" variant="destructive" disabled={isSaving} onClick={handleCancel}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Cancel slip
              </Button>
            )}
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
