"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Trash2, Save } from "lucide-react";
import type { ProcurementDetail } from "../utils/types";
import { formatPHP } from "../utils/format";
import { updatePRDetail, deletePRDetail } from "../providers/prService";
import { toast } from "sonner";

type PRLineItemsTableProps = {
  details: ProcurementDetail[];
  readOnly: boolean;
  onReload: () => void;
};

export function PRLineItemsTable({ details, readOnly, onReload }: PRLineItemsTableProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editQty, setEditQty] = useState(0);
  const [editPrice, setEditPrice] = useState(0);
  const [editUom, setEditUom] = useState("");
  const [savingId, setSavingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  function startEdit(d: ProcurementDetail) {
    setEditingId(d.id);
    setEditQty(d.qty);
    setEditPrice(d.unit_price);
    setEditUom(d.uom ?? "");
  }

  async function handleSave(detailId: number) {
    setSavingId(detailId);
    try {
      await updatePRDetail(detailId, { qty: editQty, unit_price: editPrice, uom: editUom || undefined });
      toast.success("Line item updated");
      setEditingId(null);
      onReload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setSavingId(null);
    }
  }

  async function handleDelete(detailId: number) {
    setDeletingId(detailId);
    try {
      await deletePRDetail(detailId);
      toast.success("Line item removed");
      onReload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setDeletingId(null);
    }
  }

  if (!details.length) {
    return (
      <div className="text-sm text-muted-foreground text-center py-8">No line items</div>
    );
  }

  return (
    <div className="rounded-md border overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-3 py-2 text-left font-medium">Item</th>
            <th className="px-3 py-2 text-left font-medium">Variant</th>
            <th className="px-3 py-2 text-left font-medium">UOM</th>
            <th className="px-3 py-2 text-right font-medium">Qty</th>
            <th className="px-3 py-2 text-right font-medium">Unit Price</th>
            <th className="px-3 py-2 text-right font-medium">Total</th>
            {!readOnly && <th className="px-3 py-2 text-right font-medium">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {details.map((d) => {
            const isEditing = editingId === d.id;
            const isSaving = savingId === d.id;
            const isDeleting = deletingId === d.id;
            return (
              <tr key={d.id} className="border-b last:border-0 hover:bg-muted/20">
                <td className="px-3 py-2 max-w-[200px]">
                  <div className="font-medium truncate">{d.item_name ?? d.template_name ?? "—"}</div>
                  {d.item_description && (
                    <div className="text-xs text-muted-foreground truncate">{d.item_description}</div>
                  )}
                </td>
                <td className="px-3 py-2">{d.variant_name ?? "—"}</td>
                <td className="px-3 py-2">
                  {isEditing ? (
                    <Input
                      value={editUom}
                      onChange={(e) => setEditUom(e.target.value)}
                      className="h-8 w-20 text-xs"
                    />
                  ) : (
                    d.uom ?? "—"
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  {isEditing ? (
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      value={editQty}
                      onChange={(e) => setEditQty(Number(e.target.value) || 0)}
                      className="h-8 w-20 text-xs text-right"
                    />
                  ) : (
                    <span className="tabular-nums">{d.qty}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  {isEditing ? (
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editPrice}
                      onChange={(e) => setEditPrice(Number(e.target.value) || 0)}
                      className="h-8 w-24 text-xs text-right"
                    />
                  ) : (
                    <span className="font-mono tabular-nums">{formatPHP(d.unit_price)}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">
                  {formatPHP(d.total_amount || d.qty * d.unit_price)}
                </td>
                {!readOnly && (
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {isEditing ? (
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleSave(d.id)} disabled={isSaving}>
                          {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingId(null)}>✕</Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(d)}>
                          <span className="text-xs">Edit</span>
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(d.id)} disabled={isDeleting}>
                          {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5 text-destructive" />}
                        </Button>
                      </div>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t font-medium">
            <td colSpan={5} className="px-3 py-2 text-right">Grand Total</td>
            <td className="px-3 py-2 text-right font-mono tabular-nums">
              {formatPHP(details.reduce((s, d) => s + Number(d.total_amount || d.qty * d.unit_price), 0))}
            </td>
            {!readOnly && <td></td>}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
