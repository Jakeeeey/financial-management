"use client";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn, formatCurrency } from "@/lib/utils";

import { phtDate, toPhtDateString } from "../pht";
import { PAGE_SIZE, toneClass } from "../constants";
import { TablePager } from "./TablePager";
import type { UndepositedAsset } from "../types";

type Props = {
  assets: UndepositedAsset[];
  selected: Set<number>;
  isLoading: boolean;
  page: number;
  onPageChange: (page: number) => void;
  onToggle: (id: number) => void;
  onToggleAll: (checked: boolean, ids: number[]) => void;
};

/**
 * Undeposited collections and checks, with row selection feeding the deposit dialog.
 * PDC checks are selectable only from their check date onward, per FSD 1.3.
 */
export function UndepositedTable({
  assets,
  selected,
  isLoading,
  page,
  onPageChange,
  onToggle,
  onToggleAll,
}: Props) {
  // A refetch can leave the page past the last row; clamp instead of resetting so the
  // selection the user built up is not disturbed by an unrelated page change.
  const pageCount = Math.max(1, Math.ceil(assets.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const rows = assets.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const today = phtDate();
  const isPdc = (asset: UndepositedAsset) =>
    asset.assetType === "CHECK" && asset.chequeDate ? asset.chequeDate > today : false;
  const selectableIds = rows.filter((asset) => !isPdc(asset)).map((asset) => asset.collectionDetailId);
  const allSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));

  return (
    <div className="overflow-hidden rounded-xl border border-border/50">
      <div className="flex items-center justify-between gap-2 border-b bg-muted/30 px-4 py-2.5">
        <Badge variant="outline" className={cn("shrink-0 text-[11px] font-semibold", toneClass("neutral"))}>
          {assets.length} item{assets.length === 1 ? "" : "s"}
        </Badge>
      </div>

      {isLoading ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </div>
      ) : assets.length === 0 ? (
        <p className="px-4 py-12 text-center text-sm text-muted-foreground">Nothing is waiting to be deposited.</p>
      ) : (
        <>
          <div className="hidden overflow-x-auto xl:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      aria-label="Select all undeposited items on this page"
                      checked={allSelected}
                      onCheckedChange={(checked) => onToggleAll(checked === true, selectableIds)}
                    />
                  </TableHead>
                  <TableHead className="w-[120px]">Collected</TableHead>
                  <TableHead className="w-[110px]">Type</TableHead>
                  <TableHead className="max-w-[160px]">OR / check no.</TableHead>
                  <TableHead className="max-w-[180px]">Customer</TableHead>
                  <TableHead className="max-w-[180px]">Source</TableHead>
                  <TableHead className="w-[140px] text-right">Amount</TableHead>
                  <TableHead className="w-[160px]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((asset) => {
                  const pdc = isPdc(asset);
                  return (
                    <TableRow key={asset.collectionDetailId} data-state={selected.has(asset.collectionDetailId) ? "selected" : undefined}>
                      <TableCell>
                        <Checkbox
                          aria-label={`Select ${asset.documentNumber}`}
                          disabled={pdc}
                          checked={selected.has(asset.collectionDetailId)}
                          onCheckedChange={() => onToggle(asset.collectionDetailId)}
                        />
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-mono text-sm">
                        {asset.collectionDate ? toPhtDateString(asset.collectionDate) : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn("text-[11px] font-semibold", toneClass(asset.assetType === "CASH" ? "success" : "info"))}
                        >
                          {asset.assetType === "CASH" ? "Cash" : "Check"}
                        </Badge>
                        {asset.assetType === "CHECK" && asset.bankName ? (
                          <p className="mt-0.5 max-w-[140px] truncate text-[11px] text-muted-foreground" title={asset.bankName}>
                            {asset.bankName}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell className="max-w-[160px]">
                        <p className="truncate font-mono text-sm" title={asset.documentNumber}>
                          {asset.documentNumber}
                        </p>
                        {asset.checkNo ? (
                          <p className="truncate text-[11px] text-muted-foreground" title={asset.checkNo}>
                            Check {asset.checkNo}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell className="max-w-[180px] truncate text-sm" title={asset.customer ?? undefined}>
                        {asset.customer ?? "—"}
                      </TableCell>
                      <TableCell className="max-w-[180px] truncate text-xs text-muted-foreground" title={asset.collectionReference ?? undefined}>
                        {asset.collectionReference ?? "Collections"}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">{formatCurrency(asset.amount)}</TableCell>
                      <TableCell>
                        {pdc ? (
                          <>
                            <Badge variant="outline" className={cn("text-[11px] font-semibold", toneClass("info"))}>
                              PDC
                            </Badge>
                            <p className="mt-0.5 whitespace-nowrap text-[11px] text-muted-foreground">
                              Deposit from {asset.chequeDate ? toPhtDateString(asset.chequeDate) : "—"}
                            </p>
                          </>
                        ) : asset.assetType === "CASH" && asset.ageDays >= 1 ? (
                          <Badge variant="outline" className={cn("text-[11px] font-semibold", toneClass("warning"))}>
                            Over 1 day
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">Ready</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <ul className="divide-y divide-border xl:hidden">
            {rows.map((asset) => {
              const pdc = isPdc(asset);
              return (
                <li key={asset.collectionDetailId} className="flex items-start gap-3 p-4">
                  <Checkbox
                    aria-label={`Select ${asset.documentNumber}`}
                    disabled={pdc}
                    checked={selected.has(asset.collectionDetailId)}
                    onCheckedChange={() => onToggle(asset.collectionDetailId)}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-sm font-medium" title={asset.documentNumber}>
                        {asset.documentNumber}
                      </p>
                      <span className="shrink-0 text-sm tabular-nums">{formatCurrency(asset.amount)}</span>
                    </div>
                    <p className="truncate text-xs text-muted-foreground" title={asset.customer ?? undefined}>
                      {asset.assetType === "CASH" ? "Cash" : "Check"} · {asset.customer ?? "No customer"}
                    </p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      Collected {asset.collectionDate ? toPhtDateString(asset.collectionDate) : "—"} ·{" "}
                      {asset.collectionReference ?? "Collections"}
                    </p>
                    <p className="mt-1 text-xs">
                      {pdc ? (
                        <span className="text-muted-foreground">
                          PDC · deposit from {asset.chequeDate ? toPhtDateString(asset.chequeDate) : "—"}
                        </span>
                      ) : asset.assetType === "CASH" && asset.ageDays >= 1 ? (
                        <Badge variant="outline" className={cn("text-[11px] font-semibold", toneClass("warning"))}>
                          Over 1 day
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">Ready</span>
                      )}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
          <TablePager
            page={safePage}
            pageCount={pageCount}
            total={assets.length}
            pageSize={PAGE_SIZE}
            onPageChange={onPageChange}
          />
        </>
      )}
    </div>
  );
}
