"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Trash2, Save, Plus } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { listItemTemplates, listItemVariants } from "../providers/lookupsService";
import type { ItemTemplate, ItemVariant } from "../utils/types";
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
  item_template_id: number | null;
  item_variant_id: number | null;
  template_name: string | null;
  variant_name: string | null;
  qty: number;
  unit_price: number;
  uom: string;
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

function ItemTemplateCombobox({
  value,
  templateId,
  onSelect,
  disabled,
}: {
  value: string;
  templateId: number | null;
  onSelect: (tmpl: { id: number; name: string; uom: string | null; description: string | null; base_price: number | null } | null) => void;
  disabled?: boolean;
}) {
  const [searchText, setSearchText] = useState("");
  const [selectedValue, setSelectedValue] = useState<string | null>(templateId ? `tmpl:${templateId}:${value}` : null);
  const [items, setItems] = useState<string[]>([]);
  const debouncedSearch = useDebounce(searchText, 300);

  useEffect(() => {
    if (!searchText.trim()) {
      if (selectedValue) setItems([selectedValue]);
      else setItems([]);
      return;
    }
    let cancelled = false;
    listItemTemplates(searchText).then((templates) => {
      if (cancelled) return;
      setItems(templates.map((t) => `tmpl:${t.id}:${t.name}`));
    });
    return () => { cancelled = true; };
  }, [debouncedSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleValueChange(selected: string | null) {
    if (!selected) return;
    setSelectedValue(selected);
    const parts = selected.split(":");
    if (parts[0] === "tmpl" && parts[1]) {
      const id = Number(parts[1]);
      const name = parts.slice(2).join(":");
      setSearchText("");
      const tmpl: ItemTemplate = { id, name, uom: null, base_price: null, description: null };
      onSelect(tmpl);
    }
  }

  const selectedLabel = selectedValue?.split(":").slice(2).join(":") || value;

  return (
    <div className="min-w-[180px]">
      <Combobox items={items} value={selectedValue} onValueChange={handleValueChange} disabled={disabled}>
        <ComboboxInput
          placeholder={disabled ? "—" : templateId ? selectedLabel : "Search item template..."}
          className="h-8 text-xs"
          value={selectedValue && !searchText ? selectedLabel : searchText}
          onChange={(e) => { setSearchText(e.target.value); if (selectedValue) setSelectedValue(null); }}
        />
        <ComboboxContent>
          <ComboboxEmpty>{searchText.trim() || !selectedValue ? "Type to search items" : "No results"}</ComboboxEmpty>
          <ComboboxList>
            {(item) => {
              const parts = item.split(":");
              const label = parts[0] === "tmpl" ? parts.slice(2).join(":") : item;
              return <ComboboxItem key={item} value={item}>{label}</ComboboxItem>;
            }}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  );
}

function VariantSelect({
  templateId,
  variantId,
  onChange,
  disabled,
}: {
  templateId: number | null;
  variantId: number | null;
  onChange: (variant: { id: number; name: string; list_price: number | null } | null) => void;
  disabled?: boolean;
}) {
  const [variants, setVariants] = useState<ItemVariant[]>([]);

  useEffect(() => {
    if (!templateId) { setVariants([]); return; }
    let cancelled = false;
    listItemVariants(templateId).then((vs) => {
      if (cancelled) return;
      setVariants(vs);
    });
    return () => { cancelled = true; };
  }, [templateId]);

  if (!templateId || variants.length === 0) return <span className="text-xs text-muted-foreground">—</span>;

  return (
    <Select
      value={variantId ? String(variantId) : ""}
      onValueChange={(v) => {
        const found = variants.find((x) => x.id === Number(v));
        onChange(found ?? null);
      }}
      disabled={disabled}
    >
      <SelectTrigger className="h-7 text-xs max-w-[140px]">
        <SelectValue placeholder="Select variant" />
      </SelectTrigger>
      <SelectContent>
        {variants.map((v) => (
          <SelectItem key={v.id} value={String(v.id)} className="text-xs">{v.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function PRLineItemsTable({ details, procurementId, readOnly, onDetailUpdated, onDetailDeleted, onDetailAdded }: PRLineItemsTableProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editQty, setEditQty] = useState(0);
  const [editPrice, setEditPrice] = useState(0);
  const [editUom, setEditUom] = useState("");
  const [savingId, setSavingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [newRows, setNewRows] = useState<NewRow[]>([]);
  const [filterText, setFilterText] = useState("");
  const nextId = useRef(0);

  async function handleSave(detailId: number) {
    const changes: Partial<ProcurementDetail> = { qty: editQty, unit_price: editPrice };
    if (editUom) changes.uom = editUom;
    onDetailUpdated(detailId, changes);
    setEditingId(null);
    setSavingId(detailId);
    try {
      await updatePRDetail(detailId, { qty: editQty, unit_price: editPrice, uom: editUom || undefined });
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
    const newRow: NewRow = { id: nextId.current, item_template_id: null, item_variant_id: null, template_name: null, variant_name: null, qty: 1, unit_price: 0, uom: "", saving: false };
    setNewRows((prev) => [newRow, ...prev]);
  }

  function handleTemplateSelect(id: number, tmpl: { id: number; name: string; uom: string | null; description: string | null; base_price: number | null } | null) {
    if (!tmpl) return;
    updateNewRow(id, {
      item_template_id: tmpl.id,
      item_variant_id: null,
      template_name: tmpl.name,
      variant_name: null,
      uom: tmpl.uom ?? "",
      unit_price: tmpl.base_price ?? 0,
    });
  }

  function handleVariantSelect(id: number, variant: { id: number; name: string; list_price: number | null } | null) {
    updateNewRow(id, {
      item_variant_id: variant?.id ?? null,
      unit_price: variant?.list_price ?? 0,
      variant_name: variant?.name ?? null,
    });
  }

  function updateNewRow(id: number, patch: Partial<NewRow>) {
    setNewRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  async function handleSaveNewRow(id: number) {
    const row = newRows.find((r) => r.id === id);
    if (!row) return;
    if (!row.template_name?.trim()) {
      toast.error("Item template is required");
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
        item_template_id: row.item_template_id,
        item_variant_id: row.item_variant_id,
        qty: row.qty,
        unit_price: row.unit_price,
        uom: row.uom || undefined,
      });
      setNewRows((prev) => prev.filter((r) => r.id !== id));
      onDetailAdded({
        ...created,
        template_name: row.template_name,
        variant_name: row.variant_name,
      });
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
    item_variant_id: r.item_variant_id || null,
    item_template_id: r.item_template_id || null,
    date_added: null,
    link: null,
    created_at: null,
    updated_at: null,
    template_name: r.template_name ?? null,
    variant_name: r.variant_name ?? null,
  } as ProcurementDetail));

  const allDetails = [...tempDetails, ...details];
  const filtered = allDetails.filter((d) => {
    if (filterText && !(d.template_name ?? "").toLowerCase().includes(filterText.toLowerCase())) return false;
    return true;
  });

  return (
    <div>
      {!readOnly && (
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <Button variant="outline" size="sm" onClick={handleAddRow}>
            <Plus className="h-4 w-4 mr-1" /> Add Line Item
          </Button>
          {filterText && (
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setFilterText("")}>
              Clear
            </Button>
          )}
        </div>
      )}
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
            {filtered.length === 0 && (
              <tr>
                <td colSpan={readOnly ? 5 : 7} className="text-sm text-muted-foreground text-center py-8">
                  {filterText ? "No matching line items" : "No line items"}
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
                  <td className="px-3 py-2 max-w-[220px] min-w-[180px]">
                    {isNew ? (
                      <ItemTemplateCombobox
                        value={nr?.template_name ?? ""}
                        templateId={nr?.item_template_id ?? null}
                        onSelect={(tmpl) => handleTemplateSelect(d.id, tmpl)}
                      />
                    ) : (
                      <div className="font-medium truncate">{d.template_name ?? "—"}</div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {isNew ? (
                      <VariantSelect
                        templateId={nr?.item_template_id ?? null}
                        variantId={nr?.item_variant_id ?? null}
                        onChange={(v) => handleVariantSelect(d.id, v)}
                      />
                    ) : (
                      d.variant_name ?? "—"
                    )}
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
              <td colSpan={5} className="px-3 py-2 text-right">Grand Total</td>
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
