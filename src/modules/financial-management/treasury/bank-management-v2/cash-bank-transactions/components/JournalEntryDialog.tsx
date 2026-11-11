"use client";

import { useEffect, useState } from "react";
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

import { toPhtDateString } from "../pht";
import { ApiError, fetchJournalEntry } from "../providers/transactionsApi";
import type { PostedJournalEntry } from "../types";
import { InlineAlert } from "./InlineAlert";

interface JournalEntryDialogProps {
  jeNo: string | null;
  onOpenChange: (open: boolean) => void;
}

type Loaded = { jeNo: string; entry: PostedJournalEntry | null; error: string | null };

/**
 * Read-only view of one posted entry. Leg 1 of a transfer sits in money-in-transit until the
 * value date, so the number has to be traceable to its lines instead of being printed as text.
 */
export function JournalEntryDialog({ jeNo, onOpenChange }: JournalEntryDialogProps) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    if (!jeNo) return;
    let cancelled = false;
    fetchJournalEntry(jeNo).then(
      (entry) => {
        if (!cancelled) setLoaded({ jeNo, entry, error: null });
      },
      (error: unknown) => {
        if (cancelled) return;
        const message =
          error instanceof ApiError ? error.message : "The journal entry could not be read.";
        setLoaded({ jeNo, entry: null, error: message });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [jeNo]);

  const current = loaded && loaded.jeNo === jeNo ? loaded : null;
  const entry = current?.entry ?? null;
  const totalDebit = entry?.lines.reduce((sum, line) => sum + line.debit, 0) ?? 0;
  const totalCredit = entry?.lines.reduce((sum, line) => sum + line.credit, 0) ?? 0;

  return (
    <Dialog open={jeNo !== null} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="w-[95vw] rounded-2xl p-0 sm:max-w-[720px]">
        <div className="flex max-h-[85vh] flex-col overflow-hidden">
          <DialogHeader className="border-b px-6 py-4">
            <DialogTitle className="flex flex-wrap items-center gap-2 font-mono text-base">
              {jeNo ?? "Journal entry"}
              {entry ? (
                <Badge variant={entry.status === "REVERSED" ? "secondary" : "outline"} className="font-sans">
                  {entry.status === "REVERSED" ? "Reversed" : "Posted"}
                </Badge>
              ) : null}
            </DialogTitle>
            <DialogDescription className="line-clamp-2 max-w-md">
              {entry?.description || "The ledger lines this posting wrote."}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            {!current ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Loading the entry...
              </p>
            ) : current.error ? (
              <InlineAlert tone="error">{current.error}</InlineAlert>
            ) : entry ? (
              <div className="space-y-4">
                <dl className="grid grid-cols-1 gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
                  <div className="min-w-0">
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Posting date (PHT)
                    </dt>
                    <dd className="mt-1 tabular-nums">{toPhtDateString(entry.postingDate)}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Event
                    </dt>
                    <dd className="mt-1">
                      {entry.eventCode}
                      <span className="text-muted-foreground"> · {entry.sourceModule}</span>
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Source
                    </dt>
                    <dd className="mt-1 break-words">{entry.sourceRef || "—"}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {entry.reversesJeNo ? "Reverses" : "Reversed by"}
                    </dt>
                    <dd className="mt-1 break-words font-mono text-xs">
                      {entry.reversesJeNo ?? (entry.status === "REVERSED" ? "a later entry" : "—")}
                    </dd>
                  </div>
                </dl>

                <div className="rounded-lg border">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-3 border-b bg-muted/40 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <span>Account</span>
                    <span className="text-right">Debit</span>
                    <span className="text-right">Credit</span>
                  </div>
                  <ul className="divide-y">
                    {entry.lines.map((line) => (
                      <li
                        key={line.lineNo}
                        className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-baseline gap-3 px-3 py-2 text-sm"
                      >
                        <span className="min-w-0">
                          <span className="block truncate" title={line.accountTitle ?? "Unknown account"}>
                            {line.accountTitle ?? "Unknown account"}
                          </span>
                          <span className="block truncate font-mono text-xs text-muted-foreground">
                            {line.glCode ?? line.coaId ?? "—"}
                            {line.memo ? ` · ${line.memo}` : ""}
                          </span>
                        </span>
                        <span className="w-24 text-right tabular-nums">
                          {line.debit ? formatCurrency(line.debit) : "—"}
                        </span>
                        <span className="w-24 text-right tabular-nums">
                          {line.credit ? formatCurrency(line.credit) : "—"}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-3 border-t bg-muted/40 px-3 py-2 text-sm font-medium">
                    <span>Total</span>
                    <span className="w-24 text-right tabular-nums">{formatCurrency(totalDebit)}</span>
                    <span className="w-24 text-right tabular-nums">{formatCurrency(totalCredit)}</span>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

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
