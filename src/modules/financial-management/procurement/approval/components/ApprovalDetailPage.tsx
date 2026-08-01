"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Printer, CheckCircle, FileText, Loader2, ShieldCheck } from "lucide-react";
import { usePRDetail } from "../hooks/usePRDetail";
import { PRDetailHeader } from "./PRDetailHeader";
import { PRLineItemsTable } from "./PRLineItemsTable";
import type { ProcurementDetail } from "../utils/types";
import { toBoolLike } from "../utils/parse";
import { approvePR, generatePOFromPR } from "../providers/approvalService";
import { toast } from "sonner";
import PrintProcurementDialog from "./PrintProcurementDialog";

type ApprovalDetailPageProps = {
  id: number;
};

export default function ApprovalDetailPage({ id }: ApprovalDetailPageProps) {
  const router = useRouter();
  const { master, details, loading, error, reload } = usePRDetail(id);
  const [localDetails, setLocalDetails] = useState<ProcurementDetail[]>([]);
  const [approving, setApproving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);

  useEffect(() => { setLocalDetails(details); }, [details]);

  const handleDetailUpdated = useCallback((detailId: number, changes: Partial<ProcurementDetail>) => {
    setLocalDetails((prev) => prev.map((d) => (d.id === detailId ? { ...d, ...changes } : d)));
  }, []);

  const handleDetailDeleted = useCallback((detailId: number) => {
    setLocalDetails((prev) => prev.filter((d) => d.id !== detailId));
  }, []);

  const handleDetailAdded = useCallback((detail: ProcurementDetail) => {
    setLocalDetails((prev) => [...prev, detail]);
  }, []);

  const computedTotal = localDetails.reduce((a, b) => a + Number((b.qty || 0) * (b.unit_price || 0)), 0);

  const handlePrint = useCallback(() => { setPrintDialogOpen(true); }, []);

  async function handleApprove() {
    setApproving(true);
    try {
      await approvePR(id);
      toast.success("Procurement request approved");
      setShowConfirm(false);
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to approve");
    } finally { setApproving(false); }
  }

  async function handleGeneratePO() {
    setGenerating(true);
    try {
      const result = await generatePOFromPR(id);
      toast.success(`Purchase Order #${result.purchase_order_no} generated`);
      router.push(`/fm/procurement/purchase-order/${result.purchase_order_id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate PO");
    } finally { setGenerating(false); }
  }

  const isApproved = toBoolLike(master?.isApproved);
  const readOnly = isApproved;

  if (loading) {
    return <div className="space-y-4"><Skeleton className="h-32 w-full" /><Skeleton className="h-64 w-full" /></div>;
  }

  if (error || !master) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <p className="text-sm text-destructive">Failed to load procurement request</p>
        <p className="text-xs mt-1">{error}</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => router.back()}>Go Back</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <Button variant="ghost" size="sm" onClick={() => router.push("/fm/procurement/approval")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to List
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-1" /> Print
          </Button>
          {!isApproved && (
            <Button onClick={() => setShowConfirm(true)} disabled={approving}>
              {approving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-1" />}
              Approve
            </Button>
          )}
          {isApproved && !master.po_no && (
            <Button onClick={handleGeneratePO} disabled={generating} variant="secondary">
              {generating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileText className="h-4 w-4 mr-1" />}
              Generate PO
            </Button>
          )}
          {master.po_no && (
            <Button variant="outline" onClick={() => router.push(`/fm/procurement/purchase-order/${master.po_no}`)}>
              <FileText className="h-4 w-4 mr-1" /> PO #{master.po_no}
            </Button>
          )}
        </div>
      </div>

      <PRDetailHeader master={master} computedTotal={computedTotal} />

      <Card>
        <CardHeader><CardTitle className="text-lg">Line Items</CardTitle></CardHeader>
        <CardContent>
          <PRLineItemsTable
            details={localDetails}
            procurementId={id}
            readOnly={readOnly}
            onDetailUpdated={handleDetailUpdated}
            onDetailDeleted={handleDetailDeleted}
            onDetailAdded={handleDetailAdded}
          />
        </CardContent>
      </Card>

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="max-w-md p-0 overflow-hidden rounded-2xl">
          <div className="bg-muted/20 p-6 border-b">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-50 rounded-2xl shadow-sm"><ShieldCheck className="h-6 w-6 text-emerald-600" /></div>
              <DialogTitle className="text-xl font-bold tracking-tight">Confirm Approval</DialogTitle>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <DialogDescription className="text-sm">
              Approve procurement <strong>{master.procurement_no}</strong>? This will mark it as approved and unlock purchase order generation.
            </DialogDescription>
          </div>
          <DialogFooter className="p-4 bg-muted/10 border-t flex items-center gap-2">
            <Button variant="ghost" onClick={() => setShowConfirm(false)} disabled={approving} className="flex-1">Cancel</Button>
            <Button onClick={handleApprove} disabled={approving} className="flex-[1.5] bg-emerald-600 hover:bg-emerald-700 text-white">
              {approving ? "Approving..." : "Approve"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PrintProcurementDialog
        open={printDialogOpen}
        onOpenChange={setPrintDialogOpen}
        procurementNo={master.procurement_no}
        leadDate={master.lead_date}
        status={master.status}
        isApproved={master.isApproved}
        poNo={master.po_no}
        details={localDetails}
        total={computedTotal}
        supplier={{
          supplier_name: master.supplier_name,
          address: master.supplier_address,
          email_address: master.supplier_email,
          phone_number: master.supplier_phone,
          tin_number: master.supplier_tin,
          payment_terms: master.supplier_payment_terms,
        }}
      />
    </div>
  );
}
