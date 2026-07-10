"use client";

import * as React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Eye } from "lucide-react";
import type { ProcurementRequest } from "../utils/types";
import { PRStatusBadge } from "./PRStatusBadge";
import { formatPHP, formatDate } from "../utils/format";

type PRTableProps = {
  rows: ProcurementRequest[];
  loading: boolean;
  error: string | null;
  total: number;
  onView: (id: number) => void;
};

export function PRTable({ rows, loading, error, total, onView }: PRTableProps) {
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
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>PR No.</TableHead>
            <TableHead>Supplier</TableHead>
            <TableHead>Lead Date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>PO Ref</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-mono text-xs font-medium">{row.procurement_no}</TableCell>
              <TableCell className="max-w-[200px] truncate">{row.supplier_name ?? `Supplier #${row.supplier_id}`}</TableCell>
              <TableCell>{formatDate(row.lead_date)}</TableCell>
              <TableCell><PRStatusBadge status={row.status} /></TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">{row.po_no ? `PO #${row.po_no}` : "—"}</TableCell>
              <TableCell className="text-right font-mono tabular-nums">{formatPHP(row.total_amount)}</TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="icon" onClick={() => onView(row.id)}><Eye className="h-4 w-4" /></Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {total > 0 && <div className="px-4 py-2 text-xs text-muted-foreground border-t">{total} record{total !== 1 ? "s" : ""}</div>}
    </div>
  );
}
