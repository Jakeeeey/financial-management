"use client";

import * as React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Eye, ExternalLink } from "lucide-react";
import type { ProcurementRequest } from "../utils/types";
import { PRStatusBadge } from "./PRStatusBadge";
import { formatPHP, formatDate } from "../utils/format";
import { useRouter } from "next/navigation";

type PRTableProps = {
  rows: ProcurementRequest[];
  loading: boolean;
  error: string | null;
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onView: (id: number) => void;
};

export function PRTable({ rows, loading, error, total, page, pageSize, onPageChange, onView }: PRTableProps) {
  const router = useRouter();
  if (loading) {
    return <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <p className="text-sm text-destructive">Failed to load procurement requests</p>
        <p className="text-xs mt-1">{error}</p>
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <p className="text-sm">No procurement requests found</p>
        <p className="text-xs mt-1">Try adjusting your search or filters</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table className="min-w-[800px] table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[160px] max-w-[200px]">PR No.</TableHead>
            <TableHead className="min-w-[180px] max-w-[280px]">Supplier</TableHead>
            <TableHead className="min-w-[120px] max-w-[140px]">Lead Date</TableHead>
            <TableHead className="min-w-[110px] max-w-[130px]">Status</TableHead>
            <TableHead className="min-w-[100px] max-w-[120px]">PO Ref</TableHead>
            <TableHead className="min-w-[130px] max-w-[160px] text-right">Total</TableHead>
            <TableHead className="min-w-[80px] max-w-[80px] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-mono text-xs font-medium truncate max-w-[160px]">{row.procurement_no}</TableCell>
              <TableCell className="truncate max-w-[280px]">{row.supplier_name ?? `Supplier #${row.supplier_id}`}</TableCell>
              <TableCell>{formatDate(row.lead_date)}</TableCell>
              <TableCell><PRStatusBadge status={row.status} /></TableCell>
              <TableCell>
                {row.po_no ? (
                  <button
                    onClick={() => router.push(`/fm/procurement/procurement-summary/${row.id}`)}
                    className="inline-flex items-center gap-1 font-mono text-xs text-primary hover:underline cursor-pointer"
                  >
                    PO #{row.po_no} <ExternalLink className="h-3 w-3" />
                  </button>
                ) : "—"}
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums max-w-[130px] truncate">{formatPHP(row.total_amount ?? 0)}</TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="icon" onClick={() => onView(row.id)}><Eye className="h-4 w-4" /></Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {total > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-2 text-xs text-muted-foreground border-t">
          <span>
            Showing {Math.min((page - 1) * pageSize + 1, total)}–{Math.min(page * pageSize, total)} of {total} record{total !== 1 ? "s" : ""} · Page {page} of {Math.max(1, Math.ceil(total / pageSize))}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= Math.max(1, Math.ceil(total / pageSize))}
              onClick={() => onPageChange(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
