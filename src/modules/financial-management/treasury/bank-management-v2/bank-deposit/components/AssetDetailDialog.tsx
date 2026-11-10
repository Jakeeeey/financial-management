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
import { cn, formatCurrency } from "@/lib/utils";

import { phtDate, toPhtDateString } from "../pht";
import { toneClass } from "../constants";
import type { UndepositedAsset } from "../types";

type Props = {
  asset: UndepositedAsset | null;
  selected: boolean;
  onOpenChange: (open: boolean) => void;
  onToggle: (id: number) => void;
};

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words">{children}</dd>
    </div>
  );
}

/** A single undeposited collection or customer check, with the rule that decides when it can go on a slip. */
export function AssetDetailDialog({ asset, selected, onOpenChange, onToggle }: Props) {
  const today = phtDate();
  const isPdc = Boolean(asset?.assetType === "CHECK" && asset.chequeDate && asset.chequeDate > today);
  const isAgedCash = Boolean(asset?.assetType === "CASH" && asset.ageDays >= 1);

  return (
    <Dialog open={asset !== null} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="w-[95vw] rounded-2xl p-0 sm:max-w-[640px]">
        {asset ? (
          <div className="flex max-h-[85vh] flex-col overflow-hidden">
            <DialogHeader className="border-b px-6 py-4">
              <DialogTitle className="line-clamp-1 font-mono text-base">{asset.documentNumber}</DialogTitle>
              <DialogDescription className="line-clamp-2 max-w-md">
                {asset.assetType === "CASH" ? "Cash collection" : "Customer check"} ·{" "}
                {asset.customer ?? "No customer on the collection"}
              </DialogDescription>
            </DialogHeader>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
              <dl className="grid grid-cols-1 gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
                <Detail label="Type">
                  <Badge
                    variant="outline"
                    className={cn("text-[11px] font-semibold", toneClass(asset.assetType === "CASH" ? "success" : "info"))}
                  >
                    {asset.assetType === "CASH" ? "Cash" : "Check"}
                  </Badge>
                </Detail>
                <Detail label="Status">
                  {isPdc ? (
                    <Badge variant="outline" className={cn("text-[11px] font-semibold", toneClass("info"))}>
                      Post-dated
                    </Badge>
                  ) : isAgedCash ? (
                    <Badge variant="outline" className={cn("text-[11px] font-semibold", toneClass("warning"))}>
                      Over 1 day
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">Ready to deposit</span>
                  )}
                </Detail>
                <Detail label="Collected (PHT)">
                  {asset.collectionDate ? toPhtDateString(asset.collectionDate) : "—"}
                </Detail>
                <Detail label="Age">{asset.ageDays} day(s) in the vault</Detail>
                <Detail label="Customer">{asset.customer ?? "—"}</Detail>
                <Detail label="Source">{asset.collectionReference ?? "Collections"}</Detail>
                <Detail label="Check no.">{asset.checkNo ?? "—"}</Detail>
                <Detail label="Check date">{asset.chequeDate ? toPhtDateString(asset.chequeDate) : "—"}</Detail>
                <Detail label="Drawee bank">{asset.bankName ?? "—"}</Detail>
                <Detail label="Amount">
                  <span className="tabular-nums font-medium">{formatCurrency(asset.amount)}</span>
                </Detail>
              </dl>

              {isPdc ? (
                <p className="mt-4 border-t border-border/50 pt-3 text-xs text-muted-foreground">
                  A post-dated check cannot go on a slip before its check date. It stays in the vault, tagged PDC,
                  until {asset.chequeDate ? toPhtDateString(asset.chequeDate) : "that date"}.
                </p>
              ) : isAgedCash ? (
                <p className="mt-4 border-t border-border/50 pt-3 text-xs text-muted-foreground">
                  Cash held for more than one day is an ARF finding under the Remittance Audit Result sub-module.
                  Deposit it to clear the flag.
                </p>
              ) : null}
            </div>

            <DialogFooter className="border-t bg-muted/20 px-6 py-4">
              <Button
                type="button"
                variant={selected ? "outline" : "default"}
                disabled={isPdc}
                title={isPdc ? "Not depositable before the check date" : undefined}
                onClick={() => onToggle(asset.collectionDetailId)}
              >
                {selected ? "Remove from slip" : "Add to slip"}
              </Button>
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
