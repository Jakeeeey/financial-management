"use client";

import { forwardRef } from "react";
import type { ProcurementRequest, ProcurementDetail } from "../utils/types";
import { formatPHP, formatDate } from "../utils/format";

type PRPrintContentProps = {
  master: ProcurementRequest;
  details: ProcurementDetail[];
};

export const PRPrintContent = forwardRef<HTMLDivElement, PRPrintContentProps>(
  function PRPrintContent({ master, details }, ref) {
    const grandTotal = details.reduce((s, d) => s + Number(d.total_amount), 0);

    return (
      <div ref={ref} className="p-8 text-sm" style={{ fontFamily: "system-ui, sans-serif" }}>
        <div className="text-center mb-8">
          <h1 className="text-xl font-bold uppercase">Procurement Request</h1>
          <p className="text-muted-foreground">{master.procurement_no}</p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6 text-xs">
          <div>
            <p><span className="text-muted-foreground">Supplier:</span> {master.supplier_name ?? `#${master.supplier_id}`}</p>
            <p><span className="text-muted-foreground">Lead Date:</span> {formatDate(master.lead_date)}</p>
            <p><span className="text-muted-foreground">Status:</span> {master.status ?? "—"}</p>
          </div>
          <div className="text-right">
            <p><span className="text-muted-foreground">PR No:</span> {master.procurement_no}</p>
            <p><span className="text-muted-foreground">Date Created:</span> {formatDate(master.created_at)}</p>
            {master.encoder_name && (
              <p><span className="text-muted-foreground">Encoder:</span> {master.encoder_name}</p>
            )}
          </div>
        </div>

        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-t border-black/20">
              <th className="py-1.5 text-left font-medium">Item</th>
              <th className="py-1.5 text-left font-medium">Variant</th>
              <th className="py-1.5 text-left font-medium">UOM</th>
              <th className="py-1.5 text-right font-medium">Qty</th>
              <th className="py-1.5 text-right font-medium">Unit Price</th>
              <th className="py-1.5 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {details.map((d) => (
              <tr key={d.id} className="border-b border-black/10">
                <td className="py-1.5">{d.item_name ?? d.template_name ?? "—"}</td>
                <td className="py-1.5">{d.variant_name ?? "—"}</td>
                <td className="py-1.5">{d.uom ?? "—"}</td>
                <td className="py-1.5 text-right tabular-nums">{d.qty}</td>
                <td className="py-1.5 text-right tabular-nums">{formatPHP(d.unit_price)}</td>
                <td className="py-1.5 text-right tabular-nums">{formatPHP(d.total_amount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-semibold border-t border-black/20">
              <td colSpan={5} className="py-1.5 text-right">Grand Total</td>
              <td className="py-1.5 text-right tabular-nums">{formatPHP(grandTotal)}</td>
            </tr>
          </tfoot>
        </table>

        <div className="mt-12 grid grid-cols-2 gap-8 text-xs">
          <div className="text-center">
            <div className="border-t border-black/20 pt-1 mt-8">
              <p className="font-medium">Prepared By</p>
              <p className="text-muted-foreground mt-1">{master.encoder_name ?? "—"}</p>
            </div>
          </div>
          <div className="text-center">
            <div className="border-t border-black/20 pt-1 mt-8">
              <p className="font-medium">Approved By</p>
              <p className="text-muted-foreground mt-1">{master.approved_by ? `#${master.approved_by}` : "—"}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }
);
