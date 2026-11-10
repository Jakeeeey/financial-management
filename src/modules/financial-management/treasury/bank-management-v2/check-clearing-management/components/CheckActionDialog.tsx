"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn, formatCurrency } from "@/lib/utils";

import { CHECK_RETURN_REASONS, statusLabel } from "../constants";
import { phtDate, phtDisplayStamp, toPhtDateString } from "../pht";
import { DateField } from "./DateField";
import { StatusBadge } from "./StatusBadge";
import { allowedActions, type CheckAction } from "./ChecksTable";
import type { BankCheck, CheckEvent } from "../types";
import type { CheckActionPayload } from "../providers/checksApi";

type Props = {
  check: BankCheck | null;
  action: CheckAction | null;
  open: boolean;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (check: BankCheck, payload: CheckActionPayload) => Promise<unknown>;
  loadDetail: (checkId: number) => Promise<{ check: BankCheck; events: CheckEvent[] } | null>;
  onSelectAction: (action: CheckAction) => void;
};

const PROMPT: Record<Exclude<CheckAction, "VIEW">, { title: string; body: string }> = {
  RELEASE: { title: "Release check", body: "The check leaves the safe. No journal entry is posted at release." },
  DEPOSIT: { title: "Deposit check", body: "The received check is sent to the bank and moves to in clearing." },
  CLEAR: { title: "Mark check cleared", body: "The bank has cleared this check and the journal entry will post." },
  RETURN: { title: "Record return", body: "The check came back. Pick the reason reported by the bank." },
  CANCEL: { title: "Cancel check", body: "Cancelling reverses the check. This cannot be undone." },
  REPLACE: { title: "Replace check", body: "A new check is created and linked both ways. The original keeps its status." },
};

const SOURCE_LABELS: Record<string, string> = {
  MANUAL: "Entered by hand",
  COLLECTIONS: "Collections",
  DISBURSEMENT: "Disbursement",
  REPLACEMENT: "Replacement",
};

/** The one action worth a primary button per status; everything else lives in the menu. */
const PRIMARY_ACTIONS: CheckAction[] = ["RELEASE", "DEPOSIT", "CLEAR", "REPLACE"];

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 min-w-0 break-words">{children}</dd>
    </div>
  );
}

/** One dialog for every check action, plus a read-only detail view with its event trail. */
export function CheckActionDialog({
  check,
  action,
  open,
  isSaving,
  onOpenChange,
  onSubmit,
  loadDetail,
  onSelectAction,
}: Props) {
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
  const journalEvents = events?.filter((entry) => entry.journalNo) ?? [];
  const availableActions = allowedActions(check).filter((entry) => entry.action !== "VIEW");
  const primaryAction = availableActions.find((entry) => PRIMARY_ACTIONS.includes(entry.action)) ?? availableActions[0];
  const menuActions = availableActions.filter((entry) => entry.action !== primaryAction?.action);
  const safeActions = menuActions.filter((entry) => !entry.destructive);
  const destructiveActions = menuActions.filter((entry) => entry.destructive);

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
      <DialogContent className={cn("w-[95vw] rounded-2xl p-0", isView ? "sm:max-w-[860px]" : "sm:max-w-[550px]")}>
        <div className="flex max-h-[85vh] flex-col overflow-hidden">
          <DialogHeader className="border-b px-6 py-4">
            <DialogTitle className="line-clamp-1">{isView ? `Check ${check.checkNo}` : prompt?.title}</DialogTitle>
            <DialogDescription className="line-clamp-2 max-w-md">
              {isView
                ? `${statusLabel(check.status)} · ${check.direction === "ISSUED" ? "issued by us" : "received from customer"}`
                : prompt?.body}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
            <dl className="grid grid-cols-1 gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
              {!isView ? (
                <>
                  <Detail label="Check no.">
                    {check.checkNo}
                    {check.draweeBank ? <span className="text-muted-foreground"> · {check.draweeBank}</span> : null}
                  </Detail>
                  <Detail label="Status">
                    <StatusBadge status={check.status} />
                  </Detail>
                  <Detail label="Direction">
                    {check.direction === "ISSUED" ? "Issued by us" : "Received from customer"}
                  </Detail>
                  <Detail label="Amount">
                    <span className="tabular-nums">{formatCurrency(check.amount)}</span>
                  </Detail>
                  <Detail label={check.direction === "ISSUED" ? "Payee" : "Customer"}>
                    {check.payee ?? check.payor ?? "—"}
                  </Detail>
                  <Detail label="Check date">{toPhtDateString(check.checkDate)}</Detail>
                  <Detail label="Bank account">{check.bankAccountLabel}</Detail>
                </>
              ) : null}
              <Detail label="Source">
                {SOURCE_LABELS[check.sourceType] ?? check.sourceType}
                {check.sourceRef ? <span className="text-muted-foreground"> · {check.sourceRef}</span> : null}
              </Detail>
              {check.returnReason ? <Detail label="Reason">{check.returnReason}</Detail> : null}
              {check.replacedById ? <Detail label="Replaced by">Check #{check.replacedById}</Detail> : null}
              {check.replacesId ? <Detail label="Replaces">Check #{check.replacesId}</Detail> : null}
              {check.remarks ? <Detail label="Remarks">{check.remarks}</Detail> : null}
            </dl>

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
                    placeholder="Left blank uses the next check number"
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
                  <DateField
                    id="replacement-date"
                    inDialog
                    value={replacementDate}
                    onChange={(value) => setReplacementDate(value)}
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
              <>
                {events === null ? (
                  <div className="border-t pt-4">
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : null}

                {events !== null && events.length > 0 ? (
                  <div className="border-t pt-4">
                    <p className="mb-2 text-sm font-semibold">Audit trail</p>
                    <ul className="max-h-[280px] space-y-3 overflow-y-auto">
                      {events.map((entry) => (
                        <li key={entry.id} className="flex gap-3 text-sm">
                          <span className="w-[136px] shrink-0 font-mono text-xs text-muted-foreground">
                            {phtDisplayStamp(entry.occurredAt)}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium" title={entry.action}>
                                {entry.action.replace(/_/g, " ").toLowerCase()}
                              </span>
                              {entry.toStatus ? <StatusBadge status={entry.toStatus} /> : null}
                              {entry.eventCode ? (
                                <span className="text-xs text-muted-foreground">{entry.eventCode}</span>
                              ) : null}
                              {entry.journalNo ? (
                                <span className="font-mono text-xs text-muted-foreground">{entry.journalNo}</span>
                              ) : null}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {entry.fromStatus && entry.toStatus
                                ? `${entry.fromStatus} → ${entry.toStatus}`
                                : entry.toStatus ?? ""}
                              {entry.actorName ? ` · ${entry.actorName}` : ""}
                            </p>
                            {entry.note ? <p className="mt-1 break-words text-xs">{entry.note}</p> : null}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {journalEvents.length > 0 ? (
                  <div className="border-t pt-4">
                    <p className="mb-2 text-sm font-semibold">Journal entries</p>
                    <ul className="space-y-1 rounded-lg border px-4 py-3 text-sm">
                      {journalEvents.map((entry) => (
                        <li key={entry.id} className="flex items-center justify-between gap-2">
                          <span className="font-mono text-xs">{entry.journalNo}</span>
                          <span className="text-xs text-muted-foreground">
                            {entry.eventCode ?? ""} {entry.action.replace(/_/g, " ").toLowerCase()}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </>
            )}
          </div>

          <Separator />
          <DialogFooter className="border-t bg-muted/20 px-6 py-4">
            {isView ? (
              <>
                {menuActions.length > 0 ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button type="button" variant="outline" disabled={isSaving}>
                        More actions
                        <ChevronDown className="ml-2 h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-[210px]">
                      {safeActions.map((entry) => (
                        <DropdownMenuItem key={entry.action} onSelect={() => onSelectAction(entry.action)}>
                          {entry.label}
                        </DropdownMenuItem>
                      ))}
                      {destructiveActions.length > 0 ? (
                        <>
                          <DropdownMenuSeparator />
                          {destructiveActions.map((entry) => (
                            <DropdownMenuItem
                              key={entry.action}
                              onSelect={() => onSelectAction(entry.action)}
                              className="text-destructive focus:text-destructive"
                            >
                              {entry.label}
                            </DropdownMenuItem>
                          ))}
                        </>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null}
                <DialogClose asChild>
                  <Button type="button" variant="outline" disabled={isSaving}>
                    Close
                  </Button>
                </DialogClose>
                {primaryAction ? (
                  <Button
                    type="button"
                    className="font-medium"
                    disabled={isSaving}
                    onClick={() => onSelectAction(primaryAction.action)}
                  >
                    {primaryAction.label}
                  </Button>
                ) : null}
              </>
            ) : (
              <>
                <DialogClose asChild>
                  <Button type="button" variant="outline" disabled={isSaving}>
                    Cancel
                  </Button>
                </DialogClose>
                <Button
                  type="button"
                  variant={action === "CANCEL" ? "destructive" : "default"}
                  className={
                    action === "CLEAR"
                      ? "bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700"
                      : action === "RETURN"
                        ? "bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-600 dark:hover:bg-amber-700"
                        : undefined
                  }
                  disabled={isSaving}
                  onClick={handleSubmit}
                >
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Confirm
                </Button>
              </>
            )}
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
