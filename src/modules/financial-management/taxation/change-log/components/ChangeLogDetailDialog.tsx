"use client";

import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

import { entityLabel } from "../constants";
import type { ChangeLogRow } from "../types";

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-sm">{children}</dd>
    </div>
  );
}

export function ChangeLogDetailDialog({
  row,
  companyName,
  onOpenChange,
}: {
  row: ChangeLogRow | null;
  companyName: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const open = row !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] rounded-2xl p-0 sm:max-w-[640px]">
        <div className="flex max-h-[85vh] flex-col overflow-hidden">
          <DialogHeader className="border-b px-6 py-4">
            <DialogTitle className="line-clamp-1">
              {row ? `${entityLabel(row.entity)} · ${row.field ?? "record"}` : "Change"}
            </DialogTitle>
            <DialogDescription className="line-clamp-2 max-w-md">
              {row ? row.occurredAt ?? "No timestamp recorded" : null}
            </DialogDescription>
          </DialogHeader>

          {row ? (
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
              <dl className="grid grid-cols-1 gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
                <Detail label="Company">{companyName ?? `Company ${row.companyId}`}</Detail>
                <Detail label="Actor">{row.actor ?? "Not recorded"}</Detail>
                <Detail label="Entity">{entityLabel(row.entity)}</Detail>
                <Detail label="Reference">{row.entityRef ?? "—"}</Detail>
                <Detail label="Field">{row.field ?? "—"}</Detail>
                <Detail label="Recorded">{row.occurredAt ?? "—"}</Detail>
              </dl>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-border/50 bg-muted/30 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Before</p>
                  <p className="mt-1 break-words text-sm">{row.beforeValue?.trim() ? row.beforeValue : "—"}</p>
                </div>
                <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/60 p-3 dark:border-emerald-900/50 dark:bg-emerald-950/30">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                    After
                  </p>
                  <p className="mt-1 break-words text-sm">{row.afterValue?.trim() ? row.afterValue : "—"}</p>
                </div>
              </div>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Reason</p>
                <p className="mt-1 break-words text-sm">{row.reason?.trim() ? row.reason : "No reason recorded."}</p>
              </div>
            </div>
          ) : null}

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

