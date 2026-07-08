"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Printer } from "lucide-react";
import { usePRDetail } from "../hooks/usePRDetail";
import { PRDetailHeader } from "./PRDetailHeader";
import { PRLineItemsTable } from "./PRLineItemsTable";
import { PRApprovalPanel } from "./PRApprovalPanel";
import { toBoolLike } from "../utils/parse";

type ProcurementRequestDetailPageProps = {
  id: number;
};

export default function ProcurementRequestDetailPage({ id }: ProcurementRequestDetailPageProps) {
  const router = useRouter();
  const { master, details, loading, error, reload } = usePRDetail(id);

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

  const isApproved = toBoolLike(master.isApproved);
  const readOnly = isApproved;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => router.push("/fm/procurement")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to List
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => window.open(`/fm/procurement/${id}/print`, "_blank")}>
            <Printer className="h-4 w-4 mr-1" /> Print
          </Button>
        </div>
      </div>

      <PRDetailHeader master={master} />

      <PRApprovalPanel
        procurementId={master.id}
        isApproved={isApproved}
        poNo={master.po_no}
        onReload={reload}
      />

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
    </div>
  );
}
