"use client";

import { useEffect, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/utils";

import { CHECK_RETURN_REASONS } from "../constants";
import { phtDate, phtDisplayStamp, toPhtDateString } from "../pht";
import { StatusBadge } from "./StatusBadge";
import type { BankCheck, CheckEvent } from "../types";
import type { CheckActionPayload } from "../providers/checksApi";
import type { CheckAction } from "./ChecksTable";

type Props = {
  check: BankCheck | null;
  action: CheckAction | null;
  open: boolean;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (check: BankCheck, payload: CheckActionPayload) => Promise<unknown>;
  loadDetail: (checkId: number) => Promise<{ check: BankCheck; events: CheckEvent[] } | null>;
};

const PROMPT: Record<Exclude<CheckAction, "VIEW">, { title: string; body: string }> = {
  RELEASE: { title: "Release check", body: "The check leaves the safe. No journal entry is posted at release." },
  DEPOSIT: { title: "Deposit check", body: "The received check is sent to the bank and moves to in clearing." },
  CLEAR: { title: "Mark check cleared", body: "The bank has cleared this check and the journal entry will post." },
  RETURN: { title: "Record return", body: "The check came back. Pick the reason reported by the bank." },
  CANCEL: { title: "Cancel check", body: "Cancelling reverses the check. This cannot be undone." },
  REPLACE: { title: "Replace check", body: "A new check is created and linked both ways. The original keeps its status." },
};

/** One dialog for every check action, plus a read-only detail view with its event trail. */
export function CheckActionDialog({ check, action, open, isSaving, onOpenChange, onSubmit, loadDetail }: Props) {
  const [returnReason, setReturnReason] = useState<string>("");
  const [note, setNote] = useState("");
  const [replacementDate, setReplacementDate] = useState(phtDate());
  const [replacementAmount, setReplacementAmount] = useState("");
  const [replacementNo, setReplacementNo] = useState("");
  const [events, setEvents] = useState<CheckEvent[] | null>(null);
  const [touched, setTouched] = useState(false);

  function handleOpenChange(next: boolean) {
    if (!next) {
      setReturnReason("");
      setNote("");
      setReplacementNo("");
      setTouched(false);
      setEvents(null);
    } else if (action !== "VIEW") {
      setEvents(null);
    }
    onOpenChange(next);
  }

  useEffect(() => {
    if (!open || action !== "VIEW" || !check) return;
    let cancelled = false;
    void loadDetail(check.id).then((detail) => {
      if (!cancelled) setEvents(detail?.events ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [open, action, check, loadDetail]);

  if (!check) return null;

  const isView = action === "VIEW";
  const prompt = action && action !== "VIEW" ? PROMPT[action] : null;
  const amountValue = replacementAmount || String(check.amount);
  const reasonError = action === "RETURN" && !returnReason ? "Pick the reason the bank gave." : "";
  const amountError = action === "REPLACE" && !(Number(amountValue) > 0) ? "Enter an amount greater than zero." : "";
  const hasErrors = Boolean(reasonError || amountError);

  async function handleSubmit() {
    if (!check || !action || action === "VIEW") return;
    setTouched(true);
    if (hasErrors) return;

    const payload: CheckActionPayload = { action, note: note.trim() || undefined };
    if (action === "RETURN") payload.returnReason = returnReason;
    if (action === "REPLACE") {
      payload.replacement = {
        checkDate: replacementDate,
        amount: Number(amountValue),
        checkNo: replacementNo.trim() || undefined,
      };
    }
    const saved = await onSubmit(check, payload);
    if (saved) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-[550px] p-0 rounded-2xl">
        <div className="flex max-h-[85vh] flex-col overflow-hidden">
          <DialogHeader className="border-b px-6 py-4">
            <DialogTitle className="line-clamp-1">{isView ? `Check ${check.checkNo}` : prompt?.title}</DialogTitle>
            <DialogDescription className="line-clamp-2 max-w-md">
              {isView
                ? `${check.direction === "ISSUED" ? "Issued" : "Received"} · ${check.bankAccountLabel}`
                : prompt?.body}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <StatusBadge status={check.status} className="mt-1" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Amount</p>
                <p className="tabular-nums">{formatCurrency(check.amount)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Check date</p>
                <p>{toPhtDateString(check.checkDate)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{check.direction === "ISSUED" ? "Payee" : "Payor"}</p>
                <p className="truncate" title={check.payee ?? check.payor ?? undefined}>
                  {check.payee ?? check.payor ?? "—"}
                </p>
              </div>
            </div>

            {!isView && action === "RETURN" && (
              <div className="space-y-2">
                <Label htmlFor="return-reason">
                  Return reason <span className="text-destructive">*</span>
                </Label>
                <Select value={returnReason} onValueChange={setReturnReason}>
                  <SelectTrigger id="return-reason" className="w-full">
                    <SelectValue placeholder="Select reason" />
                  </SelectTrigger>
                  <SelectContent className="max-h-80">
                    {CHECK_RETURN_REASONS.map((reason) => (
                      <SelectItem key={reason} value={reason}>
                        {reason}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {touched && reasonError && <p className="text-xs text-destructive">{reasonError}</p>}
              </div>
            )}

            {!isView && action === "REPLACE" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="replacement-check-no">New check no.</Label>
                  <Input
                    id="replacement-check-no"
                    value={replacementNo}
                    maxLength={40}
                    placeholder="Left blank uses the next leaf"
                    onChange={(event) => setReplacementNo(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="replacement-amount">
                    Amount <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="replacement-amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={amountValue}
                    onChange={(event) => setReplacementAmount(event.target.value)}
                  />
                  {touched && amountError && <p className="text-xs text-destructive">{amountError}</p>}
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="replacement-date">New check date</Label>
                  <Input
                    id="replacement-date"
                    type="date"
                    value={replacementDate}
                    onChange={(event) => setReplacementDate(event.target.value)}
                  />
                </div>
              </div>
            )}

            {!isView && (
              <div className="space-y-2">
                <Label htmlFor="action-note">Note</Label>
                <Textarea
                  id="action-note"
                  rows={2}
                  maxLength={300}
                  className="min-h-[100px] resize-none"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
              </div>
            )}

            {isView && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">History</p>
                {events === null ? (
                  <Skeleton className="h-16 w-full" />
                ) : events.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No events recorded yet.</p>
                ) : (
                  <ul className="max-h-[260px] space-y-2 overflow-y-auto">
                    {events.map((entry) => (
                      <li key={entry.id} className="rounded-lg border p-2 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate font-medium" title={entry.action}>
                            {entry.action.replace(/_/g, " ").toLowerCase()}
                          </span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {phtDisplayStamp(entry.occurredAt)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {entry.fromStatus ? `${entry.fromStatus} → ${entry.toStatus ?? "—"}` : entry.toStatus ?? ""}
                          {entry.eventCode ? ` · ${entry.eventCode}` : ""}
                          {entry.journalNo ? ` · ${entry.journalNo}` : ""}
                        </p>
                        {entry.note && <p className="mt-1 break-words text-xs">{entry.note}</p>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          <Separator />
          <DialogFooter className="border-t bg-muted/20 px-6 py-4">
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isSaving}>
                {isView ? "Close" : "Cancel"}
              </Button>
            </DialogClose>
            {!isView && (
              <Button
                type="button"
                variant={action === "CANCEL" ? "destructive" : "default"}
                disabled={isSaving}
                onClick={handleSubmit}
              >
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirm
              </Button>
            )}
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
