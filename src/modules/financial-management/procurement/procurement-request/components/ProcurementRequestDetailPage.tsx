"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Printer, CheckCircle, FileText, Loader2, ShieldCheck } from "lucide-react";
import { usePRDetail } from "../hooks/usePRDetail";
import { PRDetailHeader } from "./PRDetailHeader";
import { PRLineItemsTable } from "./PRLineItemsTable";
import { formatPHP } from "../utils/format";
import { toBoolLike } from "../utils/parse";
import { approvePR, generatePOFromPR } from "../providers/prService";
import { toast } from "sonner";

type ProcurementRequestDetailPageProps = {
  id: number;
};

function PrintContent({
  master,
  details,
  total,
}: {
  master: NonNullable<ReturnType<typeof usePRDetail>["master"]>;
  details: NonNullable<ReturnType<typeof usePRDetail>["details"]>;
  total: number;
}) {
  return (
    <div id="print-root" style={{display:"none"}}>
      <style>{`
        @media print {
          #print-root { display: block !important; }
          @page { size: A4; margin: 10mm 12mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; margin: 0; padding: 0; }
          body > :not(#print-root) { display: none !important; }
          #print-root { display: block !important; position: fixed; inset: 0; overflow: visible; background: white; z-index: 9999; padding: 0; }
          #print-root table { border-collapse: collapse; width: 100%; page-break-inside: auto; }
          #print-root thead { display: table-header-group; }
          #print-root tfoot { display: table-row-group; }
          #print-root tr { page-break-inside: avoid; }
          #print-root tbody { page-break-inside: auto; }
          #print-root th, #print-root td { border-top: 1px solid #ccc; padding: 6px 8px; font-size: 11px; vertical-align: top; }
          #print-root th { background: #F8FAFC !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; text-align: left; }
          #print-root hr { page-break-after: avoid; }
          #print-root .signature-section { page-break-inside: avoid; }
        }
      `}</style>
      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "24px" }}>
        <header style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: "22px", fontWeight: 700 }}>PROCUREMENT</div>
            <div style={{ fontSize: "13px", color: "#475569" }}>Reference: {master.procurement_no}</div>
            <div style={{ fontSize: "13px", color: "#475569" }}>Lead Date: {master.lead_date ?? "\u2014"}</div>
            <div style={{ fontSize: "13px", color: "#475569" }}>
              Status: {master.status}{master.isApproved ? " (Approved)" : ""}
            </div>
          </div>
          <div style={{ textAlign: "right", fontSize: "13px" }}>
            <div style={{ fontWeight: 600 }}>
              {master.supplier_name ?? `Supplier #${master.supplier_id ?? ""}`}
            </div>
            <div>{master.supplier_address}</div>
            <div>{master.supplier_email} {master.supplier_phone ? ` \u00B7 ${master.supplier_phone}` : ""}</div>
            <div>TIN: {master.supplier_tin}</div>
            <div>Terms: {master.supplier_payment_terms}</div>
          </div>
        </header>

        <hr style={{ margin: "16px 0" }} />

        <table style={{ width: "100%", fontSize: "13px" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
              <th style={{ padding: "6px 8px" }}>Item Template</th>
              <th style={{ padding: "6px 8px" }}>Variant</th>
              <th style={{ padding: "6px 8px" }}>UOM</th>
              <th style={{ padding: "6px 8px", textAlign: "right" }}>Qty</th>
              <th style={{ padding: "6px 8px", textAlign: "right" }}>Unit Price</th>
              <th style={{ padding: "6px 8px", textAlign: "right" }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {details.map((l: Record<string, unknown>) => {
              const uom = (l.uom as string) || "\u2014";
              return (
                <tr key={l.id as number} style={{ borderBottom: "1px solid #ccc" }}>
                  <td style={{ padding: "6px 8px" }}>{(l.template_name as string) ?? "\u2014"}</td>
                  <td style={{ padding: "6px 8px" }}>{(l.variant_name as string) ?? "\u2014"}</td>
                  <td style={{ padding: "6px 8px" }}>{uom}</td>
                  <td style={{ padding: "6px 8px", textAlign: "right" }}>{l.qty as string}</td>
                  <td style={{ padding: "6px 8px", textAlign: "right" }}>{formatPHP(l.unit_price as number)}</td>
                  <td style={{ padding: "6px 8px", textAlign: "right" }}>{formatPHP(Number(l.total_amount || (l.qty as number || 0) * (l.unit_price as number || 0)))}</td>
                </tr>
              );
            })}
            {details.length === 0 && (
              <tr><td colSpan={6} style={{ padding: "16px", textAlign: "center", color: "#64748b" }}>No lines.</td></tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={5} style={{ paddingTop: "12px", textAlign: "right", fontWeight: 600 }}>Grand Total</td>
              <td style={{ paddingTop: "12px", textAlign: "right", fontWeight: 700 }}>{formatPHP(total)}</td>
            </tr>
          </tfoot>
        </table>

        <div className="signature-section" style={{ marginTop: "32px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", fontSize: "13px" }}>
          <div>
            <div style={{ fontWeight: 600 }}>Prepared By</div>
            <div style={{ marginTop: "48px", borderTop: "1px solid #000", width: "200px" }}></div>
          </div>
          <div>
            <div style={{ fontWeight: 600 }}>Approved By</div>
            <div style={{ marginTop: "48px", borderTop: "1px solid #000", width: "200px" }}></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProcurementRequestDetailPage({ id }: ProcurementRequestDetailPageProps) {
  const router = useRouter();
  const { master, details, loading, error, reload } = usePRDetail(id);
  const [mounted, setMounted] = useState(false);
  const [approving, setApproving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const computedTotal = details.reduce((a, b) => a + Number(b.total_amount || (b.qty || 0) * (b.unit_price || 0)), 0);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  async function handleApprove() {
    setApproving(true);
    try {
      await approvePR(id, 1);
      toast.success("Procurement request approved");
      setShowConfirm(false);
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to approve");
    } finally {
      setApproving(false);
    }
  }

  async function handleGeneratePO() {
    setGenerating(true);
    try {
      const result = await generatePOFromPR(id, 1);
      toast.success(`Purchase Order #${result.purchase_order_no} generated`);
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate PO");
    } finally {
      setGenerating(false);
    }
  }

  const isApproved = toBoolLike(master?.isApproved);
  const readOnly = isApproved;

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !master) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <p className="text-sm text-destructive">Failed to load procurement request</p>
        <p className="text-xs mt-1">{error}</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => router.back()}>
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <Button variant="ghost" size="sm" onClick={() => router.push("/fm/procurement/procurement-request")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to List
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-1" /> Print
          </Button>
          {!isApproved && (
            <Button onClick={() => setShowConfirm(true)} disabled={approving}>
              {approving ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-1" />
              )}
              Approve
            </Button>
          )}
          {isApproved && !master.po_no && (
            <Button onClick={handleGeneratePO} disabled={generating} variant="secondary">
              {generating ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <FileText className="h-4 w-4 mr-1" />
              )}
              Generate PO
            </Button>
          )}
          {master.po_no && (
            <Button variant="outline" onClick={() => router.push(`/fm/procurement/purchase-order/${master.po_no}`)}>
              <FileText className="h-4 w-4 mr-1" />
              PO #{master.po_no}
            </Button>
          )}
        </div>
      </div>

      <PRDetailHeader master={master} computedTotal={computedTotal} />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Line Items</CardTitle>
        </CardHeader>
        <CardContent>
          <PRLineItemsTable
            details={details}
            readOnly={readOnly}
            onReload={reload}
          />
        </CardContent>
      </Card>

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="max-w-md p-0 overflow-hidden rounded-2xl">
          <div className="bg-muted/20 p-6 border-b">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-50 rounded-2xl shadow-sm">
                <ShieldCheck className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold tracking-tight">Confirm Approval</DialogTitle>
              </div>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <DialogDescription className="text-sm">
              Approve procurement <strong>{master.procurement_no}</strong>? This will mark it as approved and unlock purchase order generation.
            </DialogDescription>
          </div>
          <DialogFooter className="p-4 bg-muted/10 border-t flex items-center gap-2">
            <Button variant="ghost" onClick={() => setShowConfirm(false)} disabled={approving} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleApprove} disabled={approving} className="flex-[1.5] bg-emerald-600 hover:bg-emerald-700 text-white">
              {approving ? "Approving..." : "Approve"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {mounted && createPortal(
        <PrintContent master={master} details={details} total={computedTotal} />,
        document.body
      )}
    </div>
  );
}
