"use client";

import { Eye } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";

import { toPhtDateString } from "../pht";
import { PAGE_SIZE } from "../constants";
import { StatusBadge } from "./StatusBadge";
import { SlipFiltersBar } from "./SlipFilters";
import { TablePager } from "./TablePager";
import type { DepositSlip, SlipFilters } from "../types";

type Props = {
  slips: DepositSlip[];
  allSlips: DepositSlip[];
  totalCount: number;
  filters: SlipFilters;
  isLoading: boolean;
  page: number;
  onPageChange: (page: number) => void;
  onFiltersChange: (filters: SlipFilters) => void;
  onView: (slip: DepositSlip) => void;
};

/** Deposit slips already prepared, newest first. */
export function SlipsTable({
  slips,
  allSlips,
  totalCount,
  filters,
  isLoading,
  page,
  onPageChange,
  onFiltersChange,
  onView,
}: Props) {
  const pageCount = Math.max(1, Math.ceil(slips.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const rows = slips.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div className="overflow-hidden rounded-xl border border-border/50 border-t-[3px] border-t-emerald-500/70">
      <SlipFiltersBar slips={allSlips} filters={filters} onChange={onFiltersChange} />

      {isLoading ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </div>
      ) : slips.length === 0 ? (
        <p className="px-4 py-12 text-center text-sm text-muted-foreground">
          {totalCount === 0 ? "No deposit slips yet." : "No deposit slips match these filters."}
        </p>
      ) : (
        <>
          <div className="hidden overflow-x-auto lg:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">Deposit date</TableHead>
                  <TableHead className="max-w-[140px]">Slip no.</TableHead>
                  <TableHead className="max-w-[200px]">Bank account</TableHead>
                  <TableHead className="w-[130px] text-right">Cash</TableHead>
                  <TableHead className="w-[130px] text-right">Checks</TableHead>
                  <TableHead className="w-[140px] text-right">Total</TableHead>
                  <TableHead className="w-[140px]">Status</TableHead>
                  <TableHead className="w-[90px]">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((slip) => (
                  <TableRow key={slip.id}>
                    <TableCell className="whitespace-nowrap font-mono text-sm">
                      {toPhtDateString(slip.depositDate)}
                    </TableCell>
                    <TableCell className="max-w-[140px]">
                      <p className="truncate font-mono text-sm" title={slip.depositNo}>
                        {slip.depositNo}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground" title={slip.referenceNo ?? undefined}>
                        {slip.referenceNo ?? "No validation no."}
                      </p>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm" title={slip.targetBankLabel}>
                      {slip.targetBankLabel}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">{formatCurrency(slip.totalCash)}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">{formatCurrency(slip.totalChecks)}</TableCell>
                    <TableCell className="text-right text-sm font-medium tabular-nums">
                      {formatCurrency(slip.grandTotal)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={slip.status} />
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="View slip" onClick={() => onView(slip)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <ul className="divide-y divide-border lg:hidden">
            {rows.map((slip) => (
              <li key={slip.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-sm">{toPhtDateString(slip.depositDate)}</p>
                    <p className="truncate text-xs text-muted-foreground" title={slip.targetBankLabel}>
                      {slip.depositNo} · {slip.targetBankLabel}
                    </p>
                  </div>
                  <StatusBadge status={slip.status} />
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-sm tabular-nums">{formatCurrency(slip.grandTotal)}</span>
                  <Button variant="outline" size="sm" onClick={() => onView(slip)}>
                    View
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          <TablePager
            page={safePage}
            pageCount={pageCount}
            total={slips.length}
            pageSize={PAGE_SIZE}
            onPageChange={onPageChange}
            className="border-t border-border/50 px-4 py-3"
          />
        </>
      )}
    </div>
  );
}
