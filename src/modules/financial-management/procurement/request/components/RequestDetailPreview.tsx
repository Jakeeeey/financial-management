"use client";

import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft } from "lucide-react";
import { usePRPreview } from "../hooks/usePRPreview";
import { formatDate, formatPHP, formatQty } from "../utils/format";

type RequestDetailPreviewProps = {
  id: number;
};

const STATUS_MAP: Record<string, { className: string; label: string }> = {
  draft: { className: "bg-secondary text-secondary-foreground", label: "Draft" },
  pending: { className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400", label: "Pending" },
  approved: { className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400", label: "Approved" },
  rejected: { className: "bg-destructive text-destructive-foreground", label: "Rejected" },
  cancelled: { className: "bg-muted text-muted-foreground border", label: "Cancelled" },
};

function RequestStatusBadge({ status }: { status: string | null }) {
  const config = STATUS_MAP[status?.toLowerCase() ?? ""] ?? { className: "bg-secondary text-secondary-foreground", label: status ?? "—" };
  return <Badge className={config.className}>{config.label}</Badge>;
}

export function RequestDetailPreview({ id }: RequestDetailPreviewProps) {
  const router = useRouter();
  const { master, details, loading, error } = usePRPreview(id);

  if (loading) {
    return <div className="space-y-4"><Skeleton className="h-32 w-full" /><Skeleton className="h-64 w-full" /></div>;
  }

  if (error || !master) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <p className="text-sm text-destructive">Failed to load procurement request</p>
        <p className="text-xs mt-1">{error}</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => router.push("/fm/procurement/request")}>Go Back</Button>
      </div>
    );
  }

  const total = details.reduce((a, b) => a + Number((b.qty || 0) * (b.unit_price || 0)), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <Button variant="ghost" size="sm" onClick={() => router.push("/fm/procurement/request")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to New Request
        </Button>
      </div>

      <Card>
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold truncate max-w-[300px]">{master.procurement_no}</h2>
              <div className="text-sm text-muted-foreground">
                Created {formatDate(master.created_at)}
                {master.encoder_name && ` by ${master.encoder_name}`}
              </div>
            </div>
            <RequestStatusBadge status={master.status} />
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground block">Supplier</span>
              <span className="font-medium truncate block max-w-[240px]">{master.supplier_name ?? `#${master.supplier_id}`}</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Lead Date</span>
              <span>{formatDate(master.lead_date)}</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Transaction Type</span>
              <span className="capitalize">{master.transaction_type ?? "—"}</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Total Amount</span>
              <span className="block font-mono font-semibold tabular-nums max-w-[180px] truncate">{formatPHP(total)}</span>
            </div>
            {master.po_no ? (
              <div>
                <span className="text-muted-foreground block">PO Reference</span>
                <span className="font-mono text-xs">PO #{master.po_no}</span>
              </div>
            ) : null}
            {master.approved_date ? (
              <div>
                <span className="text-muted-foreground block">Approved Date</span>
                <span>{formatDate(master.approved_date)}</span>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Line Items</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Variant</TableHead>
                <TableHead className="w-20">UOM</TableHead>
                <TableHead className="w-24 text-right">Qty</TableHead>
                <TableHead className="w-32 text-right">Unit Price</TableHead>
                <TableHead className="w-32 text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {details.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium truncate max-w-[260px]" title={d.template_name ?? undefined}>{d.template_name ?? "—"}</TableCell>
                  <TableCell className="truncate max-w-[240px]" title={d.variant_name ?? undefined}>{d.variant_name ?? "—"}</TableCell>
                  <TableCell>{d.uom ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatQty(d.qty)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatPHP(d.unit_price)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatPHP(d.total_amount || d.qty * d.unit_price)}</TableCell>
                </TableRow>
              ))}
              {details.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="h-16 text-center text-muted-foreground">No line items</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <div className="mt-4 flex justify-end">
            <div className="text-sm">
              <span className="text-muted-foreground mr-2">Grand Total</span>
              <span className="font-mono font-semibold tabular-nums">{formatPHP(total)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}