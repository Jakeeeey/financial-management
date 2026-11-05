"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ProcurementDetail } from "../utils/types";
import { formatPHP, formatQty } from "../utils/format";

type PRLineItemsTableProps = {
  details: ProcurementDetail[];
};

export function PRLineItemsTable({ details }: PRLineItemsTableProps) {
  const [filterText, setFilterText] = useState("");

  const filtered = details.filter((d) => {
    if (!filterText) return true;
    const q = filterText.toLowerCase();
    return (
      (d.template_name ?? "").toLowerCase().includes(q) ||
      (d.variant_name ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <Input
          placeholder="Search line items..."
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          className="h-8 max-w-xs text-xs"
        />
        {filterText && <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setFilterText("")}>Clear</Button>}
      </div>
      <div className="rounded-md border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-3 py-2 text-left font-medium min-w-[200px] max-w-[280px]">Item</th>
              <th className="px-3 py-2 text-left font-medium min-w-[200px]">Variant</th>
              <th className="px-3 py-2 text-left font-medium w-[1%] whitespace-nowrap min-w-[80px]">UOM</th>
              <th className="px-3 py-2 text-right font-medium w-[1%] whitespace-nowrap min-w-[90px] max-w-[90px]">Qty</th>
              <th className="px-3 py-2 text-right font-medium w-[1%] whitespace-nowrap min-w-[130px] max-w-[160px]">Unit Price</th>
              <th className="px-3 py-2 text-right font-medium min-w-[120px] max-w-[160px]">Total</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="text-sm text-muted-foreground text-center py-8">{filterText ? "No matching line items" : "No line items"}</td></tr>
            )}
            {filtered.map((d) => (
              <tr key={d.id} className="border-b last:border-0 hover:bg-muted/20">
                <td className="px-3 py-2 max-w-[240px] min-w-[200px]">
                  <div className="font-medium truncate max-w-[260px]">{d.template_name ?? "—"}</div>
                </td>
                <td className="px-3 py-2">{d.variant_name ?? "—"}</td>
                <td className="px-3 py-2">{d.uom ?? "—"}</td>
                <td className="px-3 py-2 text-right max-w-[90px]">
                  <span className="tabular-nums">{formatQty(d.qty)}</span>
                </td>
                <td className="px-3 py-2 text-right max-w-[160px]">
                  <div className="font-mono tabular-nums truncate max-w-[140px]">{formatPHP(d.unit_price)}</div>
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums max-w-[160px] truncate">{formatPHP((d.qty || 0) * (d.unit_price || 0))}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t font-medium">
              <td colSpan={5} className="px-3 py-2 text-right">Grand Total</td>
              <td className="px-3 py-2 text-right font-mono tabular-nums max-w-[160px] truncate">
                {formatPHP(filtered.reduce((s, d) => s + Number((d.qty || 0) * (d.unit_price || 0)), 0))}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
