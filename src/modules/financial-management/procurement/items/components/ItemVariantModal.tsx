"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Check, ChevronDown, Loader2, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getItemById,
  getVariantById,
  createVariant,
  updateVariant,
  listUnits,
  listAttributes,
  listAttributeValues,
} from "@/modules/financial-management/procurement/items/providers/itemService";
import type {
  Unit,
  ItemVariant,
  ItemAttribute,
  ItemAttributeValue,
} from "@/modules/financial-management/procurement/items/utils/types";

interface ItemVariantModalProps {
  itemId?: number | null;
  variantId?: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

interface AttrSel {
  attrId: number;
  valueId: number;
}

export function ItemVariantModal({ itemId, variantId, open, onOpenChange, onSaved }: ItemVariantModalProps) {
  const isEdit = variantId != null;
  const [sku, setSku] = useState("");
  const [listPrice, setListPrice] = useState("");
  const [active, setActive] = useState("active");
  const [uomId, setUomId] = useState<number | null>(null);
  const [uomOpen, setUomOpen] = useState(false);
  const [selectedAttrs, setSelectedAttrs] = useState<AttrSel[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [attributes, setAttributes] = useState<ItemAttribute[]>([]);
  const [attributeValues, setAttributeValues] = useState<ItemAttributeValue[]>([]);
  const [itemName, setItemName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setSku("");
    setListPrice("");
    setActive("active");
    setUomId(null);
    setUomOpen(false);
    setSelectedAttrs([]);
    setItemName("");
    Promise.all([
      listUnits().catch(() => ({ data: [] as Unit[] })),
      listAttributes().catch(() => ({ data: [] as ItemAttribute[] })),
      listAttributeValues().catch(() => ({ data: [] as ItemAttributeValue[] })),
    ])
      .then(([unitsRes, attrsRes, valsRes]) => {
        if (cancelled) return;
        setUnits(unitsRes.data || []);
        setAttributes(attrsRes.data || []);
        setAttributeValues(valsRes.data || []);
        const vals = valsRes.data || [];

        if (variantId != null) {
          getVariantById(variantId)
            .then((res) => {
              if (cancelled) return;
              const v = res.data;
              setItemName(
                (v as ItemVariant & { _template_name?: string | null })._template_name || ""
              );
              setSku(v.sku || "");
              setListPrice(v.list_price != null ? String(v.list_price) : "");
              setActive(v.active === false || v.active === 0 ? "inactive" : "active");
              setUomId(v.uom_id ?? null);
              const valueIds = v.valueIds || [];
              setSelectedAttrs(
                valueIds
                  .map((vid) => {
                    const av = vals.find((a) => a.id === vid);
                    return av ? { attrId: Number(av.attribute_id), valueId: vid } : null;
                  })
                  .filter((x): x is AttrSel => x !== null && x.attrId > 0)
              );
            })
            .catch((err) => {
              if (cancelled) return;
              console.error("[ItemVariantModal] load variant", err);
              toast.error(err instanceof Error ? err.message : "Failed to load variant");
            })
            .finally(() => {
              if (!cancelled) setLoading(false);
            });
        } else if (itemId != null) {
          getItemById(itemId)
            .then((res) => {
              if (cancelled) return;
              setItemName(res.data.name || "");
            })
            .catch((err) => {
              if (cancelled) return;
              console.error("[ItemVariantModal] load item", err);
            })
            .finally(() => {
              if (!cancelled) setLoading(false);
            });
        } else {
          setLoading(false);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[ItemVariantModal] load lookups", err);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, variantId, itemId]);

  function autoGenName(): string {
    const vals = selectedAttrs
      .map((s) => attributeValues.find((av) => av.id === s.valueId)?.name)
      .filter(Boolean);
    return [itemName, ...vals].filter(Boolean).join(" ").trim();
  }

  const effectiveName = autoGenName();

  function addAttribute(attrId: number) {
    setSelectedAttrs((prev) => [...prev, { attrId, valueId: 0 }]);
  }

  function changeValue(attrId: number, valueId: number) {
    setSelectedAttrs((prev) => prev.map((s) => (s.attrId === attrId ? { ...s, valueId } : s)));
  }

  function removeAttribute(attrId: number) {
    setSelectedAttrs((prev) => prev.filter((s) => s.attrId !== attrId));
  }

  const unselectedAttrs = attributes.filter((a) => !selectedAttrs.some((s) => s.attrId === a.id));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!effectiveName.trim()) {
      toast.error("Variant name is required");
      return;
    }
    if (selectedAttrs.length === 0 && !uomId) {
      toast.error("A UOM is required when the variant has no attributes");
      return;
    }
    if (selectedAttrs.some((s) => s.valueId <= 0)) {
      toast.error("Each attribute must have a value selected");
      return;
    }
    setSaving(true);
    const base = {
      name: effectiveName.trim(),
      uom_id: uomId,
      sku: sku.trim() || null,
      valueIds: selectedAttrs.map((s) => s.valueId),
      ...(listPrice !== "" ? { list_price: Number(listPrice) } : {}),
    };
    try {
      if (isEdit && variantId != null) {
        await updateVariant(variantId, { ...base, active: active === "active" });
        toast.success("Variant updated");
      } else if (itemId != null) {
        await createVariant({ item_tmpl_id: itemId, ...base });
        toast.success("Variant added");
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save variant");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="truncate">{isEdit ? "Edit Variant" : "Add Variant"}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="variant-name">Variant Name *</Label>
              <Input
                id="variant-name"
                value={effectiveName}
                readOnly
                required
                className="w-full truncate min-w-0 overflow-hidden"
              />
              <p className="text-xs text-muted-foreground">
                Auto-generated from item template and attribute values.
              </p>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">UOM</Label>
              <Popover open={uomOpen} onOpenChange={setUomOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between font-normal truncate min-w-0 max-w-full"
                  >
                    <span className="truncate min-w-0">
                      {(() => {
                        const sel = units.find((u) => u.unit_id === uomId);
                        return sel ? sel.unit_shortcut || sel.unit_name : "Select UOM...";
                      })()}
                    </span>
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="p-0 w-[--radix-popover-trigger-width] max-w-[300px]"
                  align="start"
                  onWheel={(e) => e.stopPropagation()}
                >
                  <Command>
                    <CommandInput placeholder="Search UOM..." className="h-9" />
                    <CommandList className="max-h-[160px] overflow-y-auto">
                      <CommandEmpty>No results</CommandEmpty>
                      <CommandGroup>
                        {units.map((u) => {
                          const value = u.unit_shortcut || u.unit_name;
                          return (
                            <CommandItem
                              key={u.unit_id}
                              value={value}
                              onSelect={() => { setUomId(u.unit_id); setUomOpen(false); }}
                              className="w-full"
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4 shrink-0",
                                  uomId === u.unit_id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <span className="truncate min-w-0">{value}</span>
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">List Price</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={listPrice}
                  onChange={(e) => setListPrice(e.target.value)}
                  placeholder="0.00"
                  className="min-w-0 overflow-hidden"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">SKU</Label>
                <Input
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  placeholder="SKU"
                  className="min-w-0 overflow-hidden"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Attribute Values</Label>
              {selectedAttrs.map((sa) => {
                const attr = attributes.find((a) => a.id === sa.attrId);
                const options = attributeValues.filter((av) => Number(av.attribute_id) === sa.attrId);
                return (
                  <div key={sa.attrId} className="flex items-end gap-2">
                    <div className="flex-1 min-w-0 space-y-1">
                      <p className="text-xs text-muted-foreground truncate">{attr?.name || "Unknown"}</p>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            role="combobox"
                            className="w-full justify-between font-normal truncate min-w-0 max-w-full"
                          >
                            <span className="truncate min-w-0">
                              {sa.valueId > 0
                                ? options.find((o) => o.id === sa.valueId)?.name || "Select value..."
                                : "Select value..."}
                            </span>
                            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent
                          className="p-0 w-[--radix-popover-trigger-width] max-w-[300px]"
                          align="start"
                          onWheel={(e) => e.stopPropagation()}
                        >
                          <Command>
                            <CommandInput placeholder="Search..." className="h-9" />
                            <CommandList className="max-h-[160px] overflow-y-auto">
                              <CommandEmpty>No results</CommandEmpty>
                              <CommandGroup>
                                <CommandItem value="--none--" onSelect={() => changeValue(sa.attrId, 0)}>
                                  <Check className={cn("mr-2 h-4 w-4", sa.valueId === 0 ? "opacity-100" : "opacity-0")} />
                                  -- None --
                                </CommandItem>
                                {options.map((opt) => (
                                  <CommandItem
                                    key={opt.id}
                                    value={opt.name || ""}
                                    onSelect={() => changeValue(sa.attrId, opt.id)}
                                  >
                                    <Check className={cn("mr-2 h-4 w-4", sa.valueId === opt.id ? "opacity-100" : "opacity-0")} />
                                    <span className="truncate min-w-0">{opt.name}</span>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0 h-10 w-10"
                      onClick={() => removeAttribute(sa.attrId)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}

              {unselectedAttrs.length > 0 && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" size="sm" className="truncate min-w-0">
                      <Plus className="mr-1 h-4 w-4 shrink-0" />
                      <span className="truncate">Add Attribute</span>
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
                              onSelect={() => addAttribute(attr.id)}
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

            <div className="space-y-1">
              <Label className="text-xs">Status</Label>
              <RadioGroup
                value={active}
                onValueChange={setActive}
                className="flex items-center gap-4"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="active" id="variant-active" />
                  <Label htmlFor="variant-active" className="text-sm font-normal">Active</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="inactive" id="variant-inactive" />
                  <Label htmlFor="variant-inactive" className="text-sm font-normal">Inactive</Label>
                </div>
              </RadioGroup>
            </div>

            <DialogFooter className="gap-2 pt-2">
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEdit ? "Save Variant" : "Add Variant"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}