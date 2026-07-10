"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import { usePODetail } from "../hooks/usePurchaseOrders";
import { POStatusBadge } from "./POStatusBadge";
import { POPrintContent } from "./POPrintContent";
import { POReceiveDialog } from "./POReceiveDialog";
import { formatCurrency, toNum } from "../utils/po-utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, Loader2, PackagePlus } from "lucide-react";
import { createPortal } from "react-dom";

export default function PODetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = Number(params?.id);
  const { po, items, received, loading, error, refetch } = usePODetail(id);
  const [mounted, setMounted] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);

  useEffect(() => { setMounted(true); }, []); // eslint-disable-line react-hooks/set-state-in-effect

  const supplierName = (() => {
    if (typeof po?.supplier_id === "object" && po?.supplier_id && "supplier_name" in po.supplier_id) {
      return (po.supplier_id as { supplier_name?: string }).supplier_name ?? "—";
    }
    return po?.supplier_name ?? "—";
  })();

  const orderedTotal = useMemo(() => items.reduce((s, i) => s + toNum(i.qty), 0), [items]);
  const receivedTotal = useMemo(
    () => items.reduce((s, i) => s + Math.min(toNum(i.qty), Number(received[i.id ?? i.po_item_id ?? 0] || 0)), 0),
    [items, received]
  );
  const remainingTotal = Math.max(0, orderedTotal - receivedTotal);
  const progress = orderedTotal > 0 ? Math.min(1, receivedTotal / orderedTotal) : 0;

  const handlePrint = () => {
    setPrinting(true);
    setTimeout(() => {
      window.print();
      setTimeout(() => setPrinting(false), 500);
    }, 100);
  };

  const handleReceiveSuccess = () => {
    refetch();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !po) {
    return (
      <div className="space-y-4">
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error || "Purchase order not found."}
        </div>
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Go Back
        </Button>
      </div>
    );
  }

  const totalFromItems = items.reduce((sum, item) => sum + toNum(item.total_amount ?? item.line_total ?? toNum(item.qty) * toNum(item.unit_price)), 0);
  const grandTotal = totalFromItems || toNum(po.total_amount);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <Button variant="ghost" size="sm" onClick={() => router.push("/fm/procurement/purchase-order")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to List
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setReceiveOpen(true)} disabled={items.length === 0}>
            <PackagePlus className="h-4 w-4 mr-1" /> Receive &amp; Assign
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint} disabled={printing}>
            <Printer className="h-4 w-4 mr-1" /> {printing ? "Preparing..." : "Print"}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-lg">Purchase Order #{po.purchase_order_no}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {po.lead_date || po.date || "—"}
              </p>
            </div>
            <POStatusBadge status={po.status} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Supplier</span>
              <p className="font-medium">{supplierName}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Total Amount</span>
              <p className="font-medium font-mono tabular-nums">{formatCurrency(po.total_amount ?? grandTotal)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Reference</span>
              <p className="font-medium">{po.procurement_id ? `PR #${po.procurement_id}` : "—"}</p>
            </div>
            {po.date_approved && (
              <div>
                <span className="text-muted-foreground">Date Approved</span>
                <p className="font-medium">{po.date_approved}</p>
              </div>
            )}
            {po.date_received && (
              <div>
                <span className="text-muted-foreground">Last Received</span>
                <p className="font-medium">{po.date_received}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Receiving Progress</span>
            <span>
              {receivedTotal}/{orderedTotal} received &middot; Remaining {remainingTotal}
            </span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-2 rounded-full bg-emerald-500 transition-all"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Line Items</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Item</TableHead>
                <TableHead className="w-16">UOM</TableHead>
                <TableHead className="w-20 text-right">Qty</TableHead>
                <TableHead className="w-28 text-right">Unit Price</TableHead>
                <TableHead className="w-28 text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, i) => {
                const resolveName = () => {
                  if (item.item_name) return item.item_name;
                  if (typeof item.item_template_id === "object" && item.item_template_id && "name" in item.item_template_id) {
                    const name = (item.item_template_id as { name?: string }).name;
                    if (typeof item.item_variant_id === "object" && item.item_variant_id && "name" in item.item_variant_id) {
                      return `${name} - ${(item.item_variant_id as { name?: string }).name}`;
                    }
                    return name ?? "Item";
                  }
                  return "Item";
                };
                return (
                  <TableRow key={item.id ?? item.po_item_id ?? i}>
                    <TableCell>{item.line_no ?? i + 1}</TableCell>
                    <TableCell className="font-medium">{resolveName()}</TableCell>
                    <TableCell>{item.uom || "—"}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{toNum(item.qty).toFixed(2)}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{formatCurrency(item.unit_price)}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{formatCurrency(item.total_amount ?? item.line_total ?? toNum(item.qty) * toNum(item.unit_price))}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <div className="flex justify-end px-4 py-3 border-t bg-muted/20">
            <div className="text-right">
              <span className="text-sm text-muted-foreground">Grand Total</span>
              <p className="text-lg font-bold font-mono tabular-nums">{formatCurrency(grandTotal)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {po.remark && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Remark</CardTitle></CardHeader>
          <CardContent><p className="text-sm">{po.remark}</p></CardContent>
        </Card>
      )}

      {mounted && createPortal(<POPrintContent po={po} items={items} supplierName={supplierName} />, document.body)}

      <POReceiveDialog
        open={receiveOpen}
        onOpenChange={setReceiveOpen}
        poId={id}
        poItems={items}
        onSaveSuccess={handleReceiveSuccess}
      />
    </div>
  );
}
