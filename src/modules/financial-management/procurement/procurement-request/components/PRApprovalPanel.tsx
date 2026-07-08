"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, CheckCircle, FileText } from "lucide-react";
import { useRouter } from "next/navigation";
import { approvePR, generatePOFromPR } from "../providers/prService";
import { toast } from "sonner";

type PRApprovalPanelProps = {
  procurementId: number;
  isApproved: boolean;
  poNo: number | null;
  onReload: () => void;
};

export function PRApprovalPanel({ procurementId, isApproved, poNo, onReload }: PRApprovalPanelProps) {
  const router = useRouter();
  const [approving, setApproving] = useState(false);
  const [generating, setGenerating] = useState(false);

  const canApprove = !isApproved;
  const canGeneratePO = isApproved && !poNo;

  async function handleApprove() {
    setApproving(true);
    try {
      await approvePR(procurementId, 1);
      toast.success("Procurement request approved");
      onReload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to approve");
    } finally {
      setApproving(false);
    }
  }

  async function handleGeneratePO() {
    setGenerating(true);
    try {
      const result = await generatePOFromPR(procurementId, 1);
      toast.success(`Purchase Order #${result.purchase_order_no} generated`);
      onReload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate PO");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Card>
      <CardContent className="p-4 flex flex-wrap items-center gap-3">
        {canApprove && (
          <Button onClick={handleApprove} disabled={approving}>
            {approving ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <CheckCircle className="h-4 w-4 mr-1" />
            )}
            Approve
          </Button>
        )}

        {canGeneratePO && (
          <Button onClick={handleGeneratePO} disabled={generating} variant="secondary">
            {generating ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <FileText className="h-4 w-4 mr-1" />
            )}
            Generate Purchase Order
          </Button>
        )}

        {poNo && (
          <Button variant="outline" onClick={() => router.push(`/fm/procurement/purchase-order/${poNo}`)}>
            <FileText className="h-4 w-4 mr-1" />
            View PO #{poNo}
          </Button>
        )}

        {isApproved && (
          <span className="text-xs text-emerald-600 font-medium ml-auto">
            Approved
          </span>
        )}
      </CardContent>
    </Card>
  );
}
