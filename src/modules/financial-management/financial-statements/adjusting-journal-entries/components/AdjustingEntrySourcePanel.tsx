"use client";

import { Loader2, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

import type {
  AdjustingEntryPostedAdjustmentHistory,
  AdjustingEntrySourceJournal,
} from "../types";
import { balancedTolerance, formatDate, money, statusBadgeClass } from "./formatters";
import type { MoneyTotals, SourceReferencePayload } from "./types";

type AdjustingEntrySourcePanelProps = {
  linkedSourceJeNo: string;
  activeSourceReference: SourceReferencePayload | null;
  sourceJournalEntry: AdjustingEntrySourceJournal | null;
  sourceTotals: MoneyTotals;
  sourceLoading: boolean;
  postedAdjustmentHistory: AdjustingEntryPostedAdjustmentHistory | null;
  postedAdjustmentHistoryLoading: boolean;
  postedAdjustmentHistoryError: string;
  onRetryPostedAdjustments: () => void;
};

export function AdjustingEntrySourcePanel({
  linkedSourceJeNo,
  activeSourceReference,
  sourceJournalEntry,
  sourceTotals,
  sourceLoading,
  postedAdjustmentHistory,
  postedAdjustmentHistoryLoading,
  postedAdjustmentHistoryError,
  onRetryPostedAdjustments,
}: AdjustingEntrySourcePanelProps) {
  return (
    <div className="mt-5 rounded-md border bg-muted/20">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
        <div className="font-medium">Source Journal Entry</div>
        <Badge variant="outline">{linkedSourceJeNo}</Badge>
      </div>
      <div className="grid gap-3 px-3 py-3 text-sm md:grid-cols-4">
        <div>
          <div className="text-xs font-medium uppercase text-muted-foreground">Source Module</div>
          <div className="mt-1 font-medium">{activeSourceReference?.sourceModule || sourceJournalEntry?.sourceModule || "-"}</div>
        </div>
        <div>
          <div className="text-xs font-medium uppercase text-muted-foreground">Transaction Ref</div>
          <div className="mt-1 font-medium">{activeSourceReference?.sourceTransactionRef || sourceJournalEntry?.transactionRef || "-"}</div>
        </div>
        <div>
          <div className="text-xs font-medium uppercase text-muted-foreground">Source Date</div>
          <div className="mt-1 font-medium">{formatDate(activeSourceReference?.sourceTransactionDate || sourceJournalEntry?.transactionDate)}</div>
        </div>
        <div>
          <div className="text-xs font-medium uppercase text-muted-foreground">Source Status</div>
          <div className="mt-1 font-medium">{sourceJournalEntry?.status || "Linked"}</div>
        </div>
      </div>
      {sourceLoading ? (
        <div className="flex items-center gap-2 border-t px-3 py-3 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading source journal entry
        </div>
      ) : sourceJournalEntry?.details?.length ? (
        <div className="overflow-x-auto border-t">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24 text-xs">Account No.</TableHead>
                <TableHead className="text-xs">Account Title</TableHead>
                <TableHead className="w-32 text-right text-xs">Debit</TableHead>
                <TableHead className="w-32 text-right text-xs">Credit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sourceJournalEntry.details.map((line, index) => (
                <TableRow key={`${line.coaId ?? "coa"}-${index}`}>
                  <TableCell className="font-mono text-xs text-muted-foreground">{line.accountNumber || "-"}</TableCell>
                  <TableCell className="text-xs font-medium">{line.accountTitle || "-"}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{line.debit > 0 ? money(line.debit) : ""}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{line.credit > 0 ? money(line.credit) : ""}</TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/40">
                <TableCell colSpan={2} className="text-xs font-semibold">Source Total</TableCell>
                <TableCell className="text-right font-mono text-xs font-semibold">{money(sourceTotals.totalDebit)}</TableCell>
                <TableCell className="text-right font-mono text-xs font-semibold">{money(sourceTotals.totalCredit)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
          <div className="flex items-center justify-between border-t bg-background px-3 py-2 text-xs">
            <span className="text-muted-foreground">Source Variance</span>
            <span className={cn("font-mono font-semibold", Math.abs(sourceTotals.variance) >= balancedTolerance && "text-destructive")}>
              {money(sourceTotals.variance)}
            </span>
          </div>
        </div>
      ) : null}
      {!sourceLoading && (
        <div className="border-t bg-background">
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
            <div className="font-medium">Prior Posted Adjusting Entries</div>
            <Badge variant="outline">{postedAdjustmentHistory?.entries.length ?? 0} prior</Badge>
          </div>
          {postedAdjustmentHistoryLoading ? (
            <div className="flex items-center gap-2 border-t px-3 py-3 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading prior posted adjustments
            </div>
          ) : postedAdjustmentHistoryError ? (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-3 text-sm">
              <span className="text-destructive">{postedAdjustmentHistoryError}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onRetryPostedAdjustments}
              >
                <RefreshCw className="mr-2 size-4" />
                Retry
              </Button>
            </div>
          ) : postedAdjustmentHistory?.entries.length ? (
            <div className="overflow-x-auto border-t">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24 text-xs">Account No.</TableHead>
                    <TableHead className="text-xs">Account Title</TableHead>
                    <TableHead className="text-xs">Description</TableHead>
                    <TableHead className="w-32 text-right text-xs">Debit</TableHead>
                    <TableHead className="w-32 text-right text-xs">Credit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {postedAdjustmentHistory.entries.flatMap((entry) => [
                    <TableRow key={`${entry.id}-header`} className="bg-muted/30 hover:bg-muted/30">
                      <TableCell colSpan={5} className="py-2">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="font-mono font-semibold">{entry.jeNo || `AJE-${entry.id}`}</span>
                          <Badge variant="outline" className={statusBadgeClass(entry.status || "")}>
                            {entry.status || "Posted"}
                          </Badge>
                          <span className="text-muted-foreground">{formatDate(entry.transactionDate)}</span>
                        </div>
                      </TableCell>
                    </TableRow>,
                    ...entry.details.map((line, index) => (
                      <TableRow key={`${entry.id}-${line.id ?? index}`}>
                        <TableCell className="font-mono text-xs text-muted-foreground">{line.accountNumber || "-"}</TableCell>
                        <TableCell className="text-xs font-medium">{line.accountTitle || "-"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          <span className="line-clamp-2">{entry.description || "-"}</span>
                          {index === 0 && (
                            <span className="mt-0.5 block text-xs italic text-muted-foreground/80">
                              - {line.accountTitle || "Adjustment"} distribution
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">{line.debit > 0 ? money(line.debit) : ""}</TableCell>
                        <TableCell className="text-right font-mono text-xs">{line.credit > 0 ? money(line.credit) : ""}</TableCell>
                      </TableRow>
                    )),
                  ])}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="border-t px-3 py-3 text-sm text-muted-foreground">
              No prior posted adjustments for this source journal entry
            </div>
          )}
        </div>
      )}
    </div>
  );
}
