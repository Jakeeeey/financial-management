"use client";

import { useState, useEffect, useCallback } from "react";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, X } from "lucide-react";
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
  const [selectedAttrs, setSelectedAttrs] = useState<{ attrId: number; valueId: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [attrOpen, setAttrOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setSelectedAttrs([]);

    Promise.all([
      getVariantById(id),
      listAttributes().catch(() => ({ data: [] as ItemAttribute[] })),
      listAttributeValues().catch(() => ({ data: [] as ItemAttributeValue[] })),
    ])
      .then(([variantRes, attrRes, avRes]) => {
        const v = variantRes.data;
        const attrs = (attrRes as { data: ItemAttribute[] }).data || [];
        const avs = (avRes as { data: ItemAttributeValue[] }).data || [];
        setTemplateName(v._template_name ?? "");
        setName(v.name || "");
        setListPrice(v.list_price != null ? String(v.list_price) : "");
        setSku(v.sku || "");
        setActive(v.active !== false && v.active !== 0);
        setAttributes(attrs);
        setAttributeValues(avs);
        const existing = (v.valueIds || []) as number[];
        const initial = existing
          .map((vid) => {
            const av = avs.find((a) => a.id === vid);
            return av ? { attrId: Number(av.attribute_id), valueId: vid } : null;
          })
          .filter((x): x is { attrId: number; valueId: number } => x !== null && x.attrId > 0);
        setSelectedAttrs(initial);
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : "Failed to load variant");
        onOpenChange(false);
      })
      .finally(() => setLoading(false));
  }, [id, open, onOpenChange]);

  const selectedValueIds = useCallback(
    () => selectedAttrs.filter((a) => a.valueId > 0).map((a) => a.valueId),
    [selectedAttrs]
  );

  // Auto-generate variant name from template + selected attribute values
  useEffect(() => {
    if (!templateName) return;
    const vals = selectedAttrs
      .map((a) => attributeValues.find((av) => av.id === a.valueId))
      .filter((v): v is ItemAttributeValue => v !== undefined)
      .map((v) => v.name);
    setName([templateName, ...vals].filter(Boolean).join(" ").trim());
  }, [templateName, selectedAttrs, attributeValues]);

  function handleAddAttribute(attrId: number) {
    setSelectedAttrs((prev) => [...prev, { attrId, valueId: 0 }]);
    setAttrOpen(false);
  }

  function handleValueChange(attrId: number, valueId: number) {
    setSelectedAttrs((prev) =>
      prev.map((a) => (a.attrId === attrId ? { ...a, valueId } : a))
    );
  }

  function handleRemoveAttribute(attrId: number) {
    setSelectedAttrs((prev) => prev.filter((a) => a.attrId !== attrId));
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
        valueIds: selectedValueIds(),
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

  const unselectedAttrs = attributes.filter(
    (a) => !selectedAttrs.some((sa) => sa.attrId === a.id)
  );

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
              className="w-full sm:max-w-md truncate min-w-0 overflow-hidden bg-muted text-muted-foreground cursor-not-allowed"
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

            <div className="space-y-2">
              <Label>Attribute Assignments</Label>
              <div className="space-y-3">
                {selectedAttrs.map((sa) => {
                  const attr = attributes.find((a) => a.id === sa.attrId);
                  const options = attributeValues.filter(
                    (av) => Number(av.attribute_id) === sa.attrId
                  );
                  return (
                    <div key={sa.attrId} className="flex items-end gap-2">
                      <div className="flex-1 min-w-0 space-y-1">
                        <p className="text-xs text-muted-foreground truncate">{attr?.name || "Unknown"}</p>
                        <Select
                          value={String(sa.valueId)}
                          onValueChange={(val) => handleValueChange(sa.attrId, Number(val))}
                        >
                          <SelectTrigger className="w-full min-w-0 overflow-hidden">
                            <SelectValue placeholder="Select value..." />
                          </SelectTrigger>
                          <SelectContent className="!max-h-[160px] overflow-y-auto" position="popper">
                            <SelectItem value="0">-- None --</SelectItem>
                            {options.map((opt) => (
                              <SelectItem key={opt.id} value={String(opt.id)}>
                                <span className="truncate max-w-[200px] inline-block">
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
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveAttribute(sa.attrId)}
                        className="shrink-0 h-10 w-10"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}

                {unselectedAttrs.length > 0 && (
                  <Popover open={attrOpen} onOpenChange={setAttrOpen}>
                    <PopoverTrigger asChild>
                      <Button type="button" variant="outline" size="sm" className="mt-1">
                        <Plus className="mr-1 h-4 w-4" />
                        Add Attribute
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="p-0 w-64" align="start">
                      <Command>
                        <CommandInput placeholder="Search attribute..." className="h-9" />
                        <CommandList className="max-h-[200px] overflow-y-auto" onWheel={(e) => e.stopPropagation()}>
                          <CommandEmpty>No results</CommandEmpty>
                          <CommandGroup>
                            {unselectedAttrs.map((attr) => (
                              <CommandItem
                                key={attr.id}
                                value={attr.name || ""}
                                onSelect={() => handleAddAttribute(attr.id)}
                              >
                                <span className="truncate min-w-0">{attr.name}</span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            </div>

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
