"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { getVariantById, updateVariant, listAttributes, listAttributeValues } from "../providers/item-variant-service";
import type { ItemAttribute, ItemAttributeValue } from "../utils/types";

interface ItemVariantEditModalProps {
  id: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function ItemVariantEditModal({ id, open, onOpenChange, onSaved }: ItemVariantEditModalProps) {
  const [templateName, setTemplateName] = useState("");
  const [name, setName] = useState("");
  const [listPrice, setListPrice] = useState("");
  const [sku, setSku] = useState("");
  const [active, setActive] = useState(true);
  const [attributes, setAttributes] = useState<ItemAttribute[]>([]);
  const [attributeValues, setAttributeValues] = useState<ItemAttributeValue[]>([]);
  const [selectedValueIds, setSelectedValueIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setSelectedValueIds([]);

    Promise.all([
      getVariantById(id),
      listAttributes().catch(() => ({ data: [] as ItemAttribute[] })),
      listAttributeValues().catch(() => ({ data: [] as ItemAttributeValue[] })),
    ])
      .then(([variantRes, attrRes, avRes]) => {
        const v = variantRes.data;
        setTemplateName(v._template_name ?? "");
        setName(v.name || "");
        setListPrice(v.list_price != null ? String(v.list_price) : "");
        setSku(v.sku || "");
        setActive(v.active !== false && v.active !== 0);
        const attrs = (attrRes as { data: ItemAttribute[] }).data || [];
        const avs = (avRes as { data: ItemAttributeValue[] }).data || [];
        setAttributes(attrs);
        setAttributeValues(avs);
        setSelectedValueIds((v.valueIds || []) as number[]);
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : "Failed to load variant");
        onOpenChange(false);
      })
      .finally(() => setLoading(false));
  }, [id, open, onOpenChange]);

  // Auto-generate variant name from template + selected attribute values
  useEffect(() => {
    if (!templateName) return;
    const vals = selectedValueIds
      .map((vid) => attributeValues.find((av) => av.id === vid))
      .filter((v): v is ItemAttributeValue => v !== undefined)
      .map((v) => v.name);
    setName([templateName, ...vals].filter(Boolean).join(" ").trim());
  }, [templateName, selectedValueIds, attributeValues]);

  function handleValueSelect(attrId: number, valueId: number) {
    setSelectedValueIds((prev) => {
      const filtered = prev.filter((vid) => {
        const av = attributeValues.find((v) => v.id === vid);
        return Number(av?.attribute_id) !== attrId;
      });
      return valueId ? [...filtered, valueId] : filtered;
    });
  }

  function getSelectedValueId(attrId: number): number {
    const found = selectedValueIds.find((vid) => {
      const av = attributeValues.find((v) => v.id === vid);
      return Number(av?.attribute_id) === attrId;
    });
    return found ?? 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Variant name is required");
      return;
    }

    setSaving(true);
    try {
      await updateVariant(Number(id), {
        name: name.trim(),
        list_price: listPrice ? Number(listPrice) : null,
        sku: sku.trim() || null,
        active,
      });
      toast.success("Variant updated");
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update variant");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-x-hidden overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="truncate">Edit Variant</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label>Template</Label>
              <Input
                value={templateName}
                disabled
                className="w-full sm:max-w-md min-w-0 overflow-hidden bg-muted text-muted-foreground"
              />
            </div>

            <div className="space-y-2">
              <Label>Variant Name</Label>
              <Input
                value={name}
                readOnly
                className="w-full sm:max-w-md min-w-0 overflow-hidden bg-muted text-muted-foreground cursor-not-allowed"
                tabIndex={-1}
              />
              <p className="text-xs text-muted-foreground">Auto-generated from template and attribute values</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dialog-listPrice">List Price</Label>
              <Input
                id="dialog-listPrice"
                type="number"
                step="0.01"
                min="0"
                value={listPrice}
                onChange={(e) => setListPrice(e.target.value)}
                placeholder="0.00"
                className="w-full sm:max-w-[200px] min-w-0 overflow-hidden"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dialog-sku">SKU</Label>
              <Input
                id="dialog-sku"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="Optional stock keeping unit"
                className="w-full sm:max-w-md min-w-0 overflow-hidden"
              />
            </div>

            {attributes.map((attr) => {
              const options = attributeValues.filter(
                (av) => Number(av.attribute_id) === attr.id
              );
              return (
                <div key={attr.id} className="space-y-2">
                  <Label>{attr.name} (optional)</Label>
                    <Select
                      value={String(getSelectedValueId(attr.id))}
                      onValueChange={(val) => handleValueSelect(attr.id, Number(val))}
                    >
                      <SelectTrigger className="w-full sm:max-w-md min-w-0 overflow-hidden cursor-not-allowed opacity-70" disabled>
                        <SelectValue placeholder="-- None --" />
                      </SelectTrigger>
                      <SelectContent className="!max-h-[200px] overflow-y-auto">
                        <SelectItem value="0">-- None --</SelectItem>
                      {options.map((opt) => (
                        <SelectItem key={opt.id} value={String(opt.id)}>
                          <span className="truncate max-w-[240px] inline-block">
                            {opt.name}
                            {opt.extra_price && Number(opt.extra_price) > 0
                              ? ` ( +${opt.extra_price} )`
                              : ""}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            })}

            <div className="space-y-2">
              <Label>Status</Label>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="dialog-active"
                    checked={active}
                    onChange={() => setActive(true)}
                    className="h-4 w-4"
                  />
                  <span className="text-sm">Active</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="dialog-active"
                    checked={!active}
                    onChange={() => setActive(false)}
                    className="h-4 w-4"
                  />
                  <span className="text-sm">Inactive</span>
                </label>
              </div>
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancel</Button>
              </DialogClose>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
