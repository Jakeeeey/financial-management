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

import { TRANSACTION_KIND_LABELS } from "../constants";
import type { TransactionRow } from "../types";
import { InlineAlert } from "./InlineAlert";

const REASON_MIN = 3;

interface CancelMemoDialogProps {
  memo: TransactionRow | null;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (memoId: number, reason: string) => Promise<boolean>;
}

/** Cancelling never deletes: it reverses the journal entry and parks the row as REVERSED. */
export function CancelMemoDialog({ memo, isSaving, onOpenChange, onConfirm }: CancelMemoDialogProps) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const trimmed = reason.trim();
  const canSubmit = trimmed.length >= REASON_MIN && !isSaving;

  const confirm = async () => {
    if (!memo || !canSubmit) return;
    const done = await onConfirm(memo.id, trimmed);
    if (done) onOpenChange(false);
    else setError("The memo could not be cancelled. Try again.");
  };

  return (
    <Dialog open={Boolean(memo)} onOpenChange={(next) => (isSaving ? undefined : onOpenChange(next))}>
      <DialogContent className="flex w-[95vw] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-[500px]">
        <DialogHeader className="border-b border-border/50 px-6 py-4">
          <DialogTitle>Cancel this memo?</DialogTitle>
          <DialogDescription>
            {memo ? (
              <>
                {memo.refNo} · {TRANSACTION_KIND_LABELS[memo.kind]} · {formatCurrency(memo.amount)}
              </>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-3 px-6 py-4">
          <InlineAlert tone="warning">
            The posted journal entry is reversed by a mirror entry and the memo stays in the list as Reversed. Nothing is
            deleted.
          </InlineAlert>

          <div className="space-y-2">
            <Label htmlFor="cancel-reason">
              Why is it cancelled? <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="cancel-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Bank reversed the charge"
              className="min-h-[100px] resize-none"
              disabled={isSaving}
              aria-invalid={Boolean(error) || (trimmed.length > 0 && trimmed.length < REASON_MIN)}
            />
            <p className="text-xs text-muted-foreground">At least {REASON_MIN} characters. It is kept on the memo.</p>
          </div>

          {error ? <InlineAlert>{error}</InlineAlert> : null}
        </div>

        <DialogFooter className="border-t border-border/50 bg-muted/20 px-6 py-4">
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={isSaving}>
              Keep memo
            </Button>
          </DialogClose>
          <Button
            type="button"
            variant="destructive"
            onClick={confirm}
            disabled={!canSubmit}
            className="min-h-11 md:min-h-0"
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                Reversing
              </>
            ) : (
              "Cancel memo"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
