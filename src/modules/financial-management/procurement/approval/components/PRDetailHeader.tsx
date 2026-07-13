"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { PRStatusBadge } from "./PRStatusBadge";
import { formatDate, formatPHP } from "../utils/format";
import { ExternalLink } from "lucide-react";
import type { ProcurementRequest } from "../utils/types";

type PRDetailHeaderProps = {
  master: ProcurementRequest;
  computedTotal?: number;
};

export function PRDetailHeader({ master, computedTotal }: PRDetailHeaderProps) {
  const router = useRouter();
  const displayTotal = computedTotal ?? master.total_amount ?? 0;

  return (
    <Card>
      <CardContent className="p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold">{master.procurement_no}</h2>
            <div className="text-sm text-muted-foreground">
              Created {formatDate(master.created_at)}
              {master.encoder_name && ` by ${master.encoder_name}`}
            </div>
          </div>
          <PRStatusBadge status={master.status} />
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground block">Supplier</span>
            <span className="font-medium">{master.supplier_name ?? `#${master.supplier_id}`}</span>
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
            <span className="block font-mono font-semibold tabular-nums">{formatPHP(displayTotal)}</span>
          </div>
          {master.department_name && (
            <div>
              <span className="text-muted-foreground block">Department</span>
              <span>{master.department_name}</span>
            </div>
          )}
          {master.po_no && (
            <div>
              <span className="text-muted-foreground block">PO Reference</span>
              <button
                onClick={() => router.push(`/fm/procurement/purchase-order/${master.po_no}`)}
                className="inline-flex items-center gap-1 font-mono text-xs text-primary hover:underline cursor-pointer"
              >
                PO #{master.po_no} <ExternalLink className="h-3 w-3" />
              </button>
            </div>
          )}
          {master.approved_date && (
            <div>
              <span className="text-muted-foreground block">Approved Date</span>
              <span>{formatDate(master.approved_date)}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
