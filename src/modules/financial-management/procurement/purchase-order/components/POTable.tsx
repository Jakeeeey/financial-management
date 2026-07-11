"use client";

import { useRouter } from "next/navigation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { POStatusBadge } from "./POStatusBadge";
import { formatCurrency } from "../utils/po-utils";
import type { PurchaseOrder } from "../utils/types";

interface POTableProps {
  data: PurchaseOrder[];
  loading: boolean;
  error: string | null;
}

export function POTable({ data, loading, error }: POTableProps) {
  const router = useRouter();

  if (error) {
    return <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>;
  }

  if (loading) {
    return (
      <div className="rounded-md border p-8">
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 bg-muted animate-pulse rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="rounded-md border p-8 text-center text-sm text-muted-foreground">
        No purchase orders found.
      </div>
    );
  }

  return (
    <div className="rounded-md border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[180px]">PO No.</TableHead>
            <TableHead>Supplier</TableHead>
            <TableHead className="w-[120px]">Date</TableHead>
            <TableHead className="w-[140px] text-right">Total</TableHead>
            <TableHead className="w-[130px]">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((po) => (
            <TableRow
              key={po.id ?? po.purchase_order_id}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => router.push(`/fm/procurement/purchase-order/${po.id ?? po.purchase_order_id}`)}
            >
              <TableCell className="font-medium">{po.purchase_order_no || "—"}</TableCell>
              <TableCell className="text-muted-foreground">{(po as unknown as Record<string, unknown>)._supplier_name as string || "—"}</TableCell>
              <TableCell>{po.lead_date || po.date || "—"}</TableCell>
              <TableCell className="text-right font-mono tabular-nums">{formatCurrency(po.total_amount)}</TableCell>
              <TableCell><POStatusBadge status={po.inventory_status} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
