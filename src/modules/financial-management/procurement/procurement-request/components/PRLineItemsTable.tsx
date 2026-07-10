"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Trash2, Save, Plus, Search, X } from "lucide-react";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxList,
  ComboboxItem,
} from "@/components/ui/combobox";
import type { ProcurementDetail } from "../utils/types";
import { formatPHP } from "../utils/format";
import { createPRDetail, updatePRDetail, deletePRDetail } from "../providers/prService";
import { searchSuppliers } from "../providers/lookupsService";
import { toast } from "sonner";

type PRLineItemsTableProps = {
  details: ProcurementDetail[];
  procurementId: number;
  readOnly: boolean;
  onDetailUpdated: (detailId: number, changes: Partial<ProcurementDetail>) => void;
  onDetailDeleted: (detailId: number) => void;
  onDetailAdded: (detail: ProcurementDetail) => void;
};

type NewRow = {
  id: number;
  item_name: string;
  qty: number;
  unit_price: number;
  uom: string;
  supplier: number | null;
  supplier_label: string;
  saving: boolean;
};

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

function SupplierCombobox({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (id: number | null, label: string) => void;
  disabled?: boolean;
}) {
  const [searchText, setSearchText] = useState("");
  const [selectedValue, setSelectedValue] = useState<string | null>(value || null);
  const [items, setItems] = useState<string[]>([]);
  const debouncedSearch = useDebounce(searchText, 300);

  useEffect(() => {
    if (!searchText.trim()) {
      setItems([]);
      return;
    }
    let cancelled = false;
    searchSuppliers(searchText).then((suppliers) => {
      if (cancelled) return;
      setItems(suppliers.map((s) => `${s.id}:${s.supplier_name}`));
    });
    return () => { cancelled = true; };
  }, [debouncedSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleValueChange(selected: string | null) {
    if (!selected) return;
    setSelectedValue(selected);
    setSearchText("");
    const colonIdx = selected.indexOf(":");
    const id = colonIdx > 0 ? Number(selected.slice(0, colonIdx)) : null;
    const label = colonIdx > 0 ? selected.slice(colonIdx + 1) : selected;
    onChange(id, label);
  }

  return (
    <div className="flex items-center gap-1">
      <Combobox items={items} value={selectedValue} onValueChange={handleValueChange} disabled={disabled}>
        <ComboboxInput
          placeholder={disabled ? "—" : "Supplier"}
          className="h-8 text-xs w-32"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
        <ComboboxContent>
          <ComboboxEmpty>No results</ComboboxEmpty>
          <ComboboxList>
            {(item) => (
              <ComboboxItem key={item} value={item}>
                {item.includes(":") ? item.slice(item.indexOf(":") + 1) : item}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      {value && !disabled && (
        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => { setSelectedValue(null); setSearchText(""); setItems([]); onChange(null, ""); }}>
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}

export function PRLineItemsTable({ details, procurementId, readOnly, onDetailUpdated, onDetailDeleted, onDetailAdded }: PRLineItemsTableProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editQty, setEditQty] = useState(0);
  const [editPrice, setEditPrice] = useState(0);
  const [editUom, setEditUom] = useState("");
  const [editSupplier, setEditSupplier] = useState<number | null>(null);
  const [editSupplierLabel, setEditSupplierLabel] = useState("");
  const [savingId, setSavingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [newRows, setNewRows] = useState<NewRow[]>([]);
  const [filterText, setFilterText] = useState("");
  const [filterSupplier, setFilterSupplier] = useState<number | null>(null);
  const [filterSupplierLabel, setFilterSupplierLabel] = useState("");
  const nextId = useRef(0);

  async function handleSave(detailId: number) {
    const changes: Partial<ProcurementDetail> = { qty: editQty, unit_price: editPrice };
    if (editUom) changes.uom = editUom;
    if (editSupplier !== undefined) changes.supplier = editSupplier;
    onDetailUpdated(detailId, changes);
    setEditingId(null);
    setSavingId(detailId);
    try {
      await updatePRDetail(detailId, { qty: editQty, unit_price: editPrice, uom: editUom || undefined, supplier: editSupplier });
      toast.success("Line item updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setSavingId(null);
    }
  }

  async function startEdit(d: ProcurementDetail) {
    if (editingId !== null && editingId !== d.id) {
      await handleSave(editingId);
    }
    setEditingId(d.id);
    setEditQty(d.qty);
    setEditPrice(d.unit_price);
    setEditUom(d.uom ?? "");
    setEditSupplier(d.supplier);
    setEditSupplierLabel(d.supplier_name ?? "");
  }

  function handleCancel() {
    setEditingId(null);
  }

  async function handleDelete(detailId: number) {
    onDetailDeleted(detailId);
    setDeletingId(detailId);
    try {
      await deletePRDetail(detailId);
      toast.success("Line item removed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setDeletingId(null);
    }
  }

  function handleAddRow() {
    nextId.current -= 1;
    const newRow: NewRow = { id: nextId.current, item_name: "", qty: 1, unit_price: 0, uom: "", supplier: null, supplier_label: "", saving: false };
    setNewRows((prev) => [newRow, ...prev]);
  }

  function updateNewRow(id: number, patch: Partial<NewRow>) {
    setNewRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  async function handleSaveNewRow(id: number) {
    const row = newRows.find((r) => r.id === id);
    if (!row) return;
    if (!row.item_name.trim()) {
      toast.error("Item name is required");
      return;
    }
    if (row.qty <= 0) {
      toast.error("Qty must be greater than 0");
      return;
    }
    updateNewRow(id, { saving: true });
    try {
      const created = await createPRDetail({
        procurement_id: procurementId,
        item_name: row.item_name.trim(),
        qty: row.qty,
        unit_price: row.unit_price,
        uom: row.uom || undefined,
        supplier: row.supplier,
      });
      setNewRows((prev) => prev.filter((r) => r.id !== id));
      onDetailAdded(created);
      toast.success("Line item added");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add line item");
      updateNewRow(id, { saving: false });
    }
  }

  function handleDiscardNewRow(id: number) {
    setNewRows((prev) => prev.filter((r) => r.id !== id));
  }

  function handleDeleteNewRow(id: number) {
    setNewRows((prev) => prev.filter((r) => r.id !== id));
  }

  const tempDetails = newRows.map((r) => ({
    id: r.id,
    procurement_id: procurementId,
    qty: r.qty,
    unit_price: r.unit_price,
    total_amount: r.qty * r.unit_price,
    uom: r.uom || null,
    item_name: r.item_name || null,
    supplier: r.supplier,
    supplier_name: r.supplier_label || null,
    item_description: null,
    item_variant_id: null,
    item_template_id: null,
    date_added: null,
    link: null,
    created_at: null,
    updated_at: null,
    template_name: null,
    variant_name: null,
  } as ProcurementDetail));

  const allDetails = [...tempDetails, ...details];
  const filtered = allDetails.filter((d) => {
    if (filterText && !(d.item_name ?? "").toLowerCase().includes(filterText.toLowerCase()) && !(d.template_name ?? "").toLowerCase().includes(filterText.toLowerCase())) return false;
    if (filterSupplier !== null && d.supplier !== filterSupplier) return false;
    return true;
  });

  return (
    <div>
      {!readOnly && (
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <Button variant="outline" size="sm" onClick={handleAddRow}>
            <Plus className="h-4 w-4 mr-1" /> Add Line Item
          </Button>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                placeholder="Search items..."
                className="h-8 pl-7 pr-2 text-xs w-40"
              />
            </div>
            <SupplierCombobox
              value={filterSupplierLabel}
              onChange={(id, label) => { setFilterSupplier(id); setFilterSupplierLabel(label); }}
            />
            {(filterText || filterSupplier !== null) && (
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setFilterText(""); setFilterSupplier(null); setFilterSupplierLabel(""); }}>
                Clear
              </Button>
            )}
          </div>
        </div>
      )}
      <div className="rounded-md border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-3 py-2 text-left font-medium">Item</th>
              {!readOnly && <th className="px-3 py-2 text-left font-medium">Supplier</th>}
              <th className="px-3 py-2 text-left font-medium">Variant</th>
              <th className="px-3 py-2 text-left font-medium">UOM</th>
              <th className="px-3 py-2 text-right font-medium">Qty</th>
              <th className="px-3 py-2 text-right font-medium">Unit Price</th>
              <th className="px-3 py-2 text-right font-medium">Total</th>
              {!readOnly && <th className="px-3 py-2 text-right font-medium">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={readOnly ? 6 : 8} className="text-sm text-muted-foreground text-center py-8">
                  {filterText || filterSupplier !== null ? "No matching line items" : "No line items"}
                </td>
              </tr>
            )}
            {filtered.map((d) => {
              const isNew = d.id < 0;
              const isEditing = editingId === d.id;
              const isSaving = savingId === d.id;
              const isDeleting = deletingId === d.id;
              const nr = isNew ? newRows.find((r) => r.id === d.id) : null;
              return (
                <tr key={d.id} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="px-3 py-2 max-w-[160px]">
                    {isNew ? (
                      <Input
                        value={nr?.item_name ?? ""}
                        onChange={(e) => updateNewRow(d.id, { item_name: e.target.value })}
                        placeholder="Item name"
                        className="h-8 text-xs"
                      />
                    ) : (
                      <>
                        <div className="font-medium truncate">{d.item_name ?? d.template_name ?? "—"}</div>
                        {d.item_description && <div className="text-xs text-muted-foreground truncate">{d.item_description}</div>}
                      </>
                    )}
                  </td>
                  {!readOnly && (
                    <td className="px-3 py-2">
                      {isNew ? (
                        <SupplierCombobox
                          value={nr?.supplier_label ?? ""}
                          onChange={(id, label) => updateNewRow(d.id, { supplier: id, supplier_label: label })}
                        />
                      ) : isEditing ? (
                        <SupplierCombobox
                          value={editSupplierLabel}
                          onChange={(id, label) => { setEditSupplier(id); setEditSupplierLabel(label); }}
                        />
                      ) : (
                        <span className="text-xs">{d.supplier_name ?? "—"}</span>
                      )}
                    </td>
                  )}
                  <td className="px-3 py-2">
                    {isNew ? "—" : (d.variant_name ?? "—")}
                  </td>
                  <td className="px-3 py-2">
                    {isNew ? (
                      <Input
                        value={nr?.uom ?? ""}
                        onChange={(e) => updateNewRow(d.id, { uom: e.target.value })}
                        placeholder="UOM"
                        className="h-8 w-16 text-xs"
                      />
                    ) : isEditing ? (
                      <Input
                        value={editUom}
                        onChange={(e) => setEditUom(e.target.value)}
                        className="h-8 w-16 text-xs"
                      />
                    ) : (
                      d.uom ?? "—"
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {isNew ? (
                      <Input
                        type="number"
                        min="1"
                        step="1"
                        value={nr?.qty ?? 1}
                        onChange={(e) => updateNewRow(d.id, { qty: Number(e.target.value) || 0 })}
                        className="h-8 w-16 text-xs text-right"
                      />
                    ) : isEditing ? (
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={editQty}
                        onChange={(e) => setEditQty(Number(e.target.value) || 0)}
                        className="h-8 w-16 text-xs text-right"
                      />
                    ) : (
                      <span className="tabular-nums">{d.qty}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {isNew ? (
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={nr?.unit_price ?? 0}
                        onChange={(e) => updateNewRow(d.id, { unit_price: Number(e.target.value) || 0 })}
                        className="h-8 w-20 text-xs text-right"
                      />
                    ) : isEditing ? (
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editPrice}
                        onChange={(e) => setEditPrice(Number(e.target.value) || 0)}
                        className="h-8 w-20 text-xs text-right"
                      />
                    ) : (
                      <span className="font-mono tabular-nums">{formatPHP(d.unit_price)}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">
                    {isNew
                      ? formatPHP((nr?.qty ?? 0) * (nr?.unit_price ?? 0))
                      : formatPHP((d.qty || 0) * (d.unit_price || 0))}
                  </td>
                  {!readOnly && (
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {isNew ? (
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleSaveNewRow(d.id)} disabled={nr?.saving}>
                            {nr?.saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDiscardNewRow(d.id)}>✕</Button>
                        </div>
                      ) : isEditing ? (
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleSave(d.id)} disabled={isSaving}>
                            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleCancel}>✕</Button>
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
              <td colSpan={readOnly ? 5 : 6} className="px-3 py-2 text-right">Grand Total</td>
              <td className="px-3 py-2 text-right font-mono tabular-nums">
                {formatPHP(filtered.reduce((s, d) => {
                  if (d.id === editingId) return s + Number(editQty * editPrice);
                  return s + Number((d.qty || 0) * (d.unit_price || 0));
                }, 0))}
              </td>
              {!readOnly && <td></td>}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
