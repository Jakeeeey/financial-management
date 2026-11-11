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

import { statusTone, toneClass } from "../constants";
import { toPhtDateString } from "../pht";
import type { ArfFinding } from "../types";

type Props = {
  finding: ArfFinding | null;
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

/**
 * Read-only view of one ARF finding. The finding names the record, the account and the rule
 * that fired; resolving it is the owning module's job, so nothing here navigates away.
 */
export function ArfFindingDialog({ finding, onOpenChange }: Props) {
  return (
    <Dialog open={finding !== null} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="w-[95vw] rounded-2xl p-0 sm:max-w-[720px]">
        {finding ? (
          <div className="flex max-h-[85vh] flex-col overflow-hidden">
            <DialogHeader className="border-b px-6 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={toneClass(statusTone(finding.severity))}>
                  {finding.severity}
                </Badge>
                <span className="text-xs text-muted-foreground">{finding.subModule}</span>
              </div>
              <DialogTitle className="mt-1 text-left">{finding.title}</DialogTitle>
              <DialogDescription className="text-left">{finding.detail}</DialogDescription>
            </DialogHeader>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
              <dl className="grid grid-cols-1 gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
                <Detail label="Account">
                  {finding.account ?? <span className="text-muted-foreground">No bank account on this record</span>}
                </Detail>
                <Detail label="Amount">
                  {finding.amount === null ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <span className="tabular-nums font-medium">{formatCurrency(finding.amount)}</span>
                  )}
                </Detail>
                <Detail label="Reference">{finding.reference ?? "—"}</Detail>
                <Detail label="Occurred (PHT)">
                  {finding.occurredAt ? toPhtDateString(finding.occurredAt) : "—"}
                </Detail>
                <Detail label="Source record">
                  <span className="font-mono text-xs">{finding.source}</span>
                </Detail>
                <Detail label="Finding key">
                  <span className="font-mono text-xs">{finding.key}</span>
                </Detail>
              </dl>

              <div className="mt-5 border-t border-border/50 pt-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Rule that fired</p>
                <p className="mt-1 text-sm">{finding.rule}</p>
              </div>

              <div className="mt-4 rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">
                <p className="font-semibold text-foreground">Audit context</p>
                <p className="mt-1">
                  Recomputed from live records on every load; nothing is stored. Severity order is CRITICAL, HIGH, MEDIUM,
                  then newest first. Resolving the underlying record makes the row disappear on the next refresh.
                </p>
              </div>
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
