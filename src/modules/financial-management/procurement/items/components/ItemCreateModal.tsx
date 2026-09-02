"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Check, ChevronDown, Loader2, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { createItem, createVariant, listUnits, listAttributes, listAttributeValues } from "@/modules/financial-management/procurement/items/providers/itemService";
import type { Unit, ItemAttribute, ItemAttributeValue } from "@/modules/financial-management/procurement/items/utils/types";

interface ItemCreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

interface AttrSelection {
  attrId: number;
  valueId: number;
}

interface VariantDraft {
  key: number;
  selectedAttrs: AttrSelection[];
  uom_id: number | null;
  listPrice: string;
  sku: string;
}

let variantKey = 0;
const nextKey = () => ++variantKey;

export function ItemCreateModal({ open, onOpenChange, onSaved }: ItemCreateModalProps) {
  const [name, setName] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [description, setDescription] = useState("");
  const [active, setActive] = useState("active");
  const [units, setUnits] = useState<Unit[]>([]);
  const [attributes, setAttributes] = useState<ItemAttribute[]>([]);
  const [attributeValues, setAttributeValues] = useState<ItemAttributeValue[]>([]);
  const [variants, setVariants] = useState<VariantDraft[]>([]);
  const [addVariants, setAddVariants] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(""); setBasePrice(""); setDescription(""); setActive("active");
    setVariants([]); setAddVariants(false);
    listUnits().then((r) => setUnits(r.data || [])).catch(() => {});
    listAttributes().then((r) => setAttributes(r.data || [])).catch(() => {});
    listAttributeValues().then((r) => setAttributeValues(r.data || [])).catch(() => {});
  }, [open]);

  function variantName(draft: VariantDraft): string {
    const values = draft.selectedAttrs
      .map((s) => attributeValues.find((av) => av.id === s.valueId)?.name)
      .filter(Boolean);
    return [name, ...values].filter(Boolean).join(" ").trim();
  }

  function updateVariant(draftKey: number, patch: Partial<VariantDraft>) {
    setVariants((prev) => prev.map((v) => (v.key === draftKey ? { ...v, ...patch } : v)));
  }

  function addAttribute(draftKey: number, attrId: number) {
    const draft = variants.find((v) => v.key === draftKey)!;
    updateVariant(draftKey, { selectedAttrs: [...draft.selectedAttrs, { attrId, valueId: 0 }] });
  }

  function changeValue(draftKey: number, attrId: number, valueId: number) {
    const draft = variants.find((v) => v.key === draftKey)!;
    updateVariant(draftKey, {
      selectedAttrs: draft.selectedAttrs.map((s) => (s.attrId === attrId ? { ...s, valueId } : s)),
    });
  }

  function removeAttribute(draftKey: number, attrId: number) {
    const draft = variants.find((v) => v.key === draftKey)!;
    updateVariant(draftKey, { selectedAttrs: draft.selectedAttrs.filter((s) => s.attrId !== attrId) });
  }

  function addVariant() {
    setVariants((prev) => [...prev, { key: nextKey(), selectedAttrs: [], uom_id: null, listPrice: "", sku: "" }]);
  }

  function removeVariant(draftKey: number) {
    setVariants((prev) => prev.filter((v) => v.key !== draftKey));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { toast.error("Item name is required"); return; }
    const drafts = addVariants ? variants : [];
    const invalid = drafts.find((v) => v.selectedAttrs.length === 0 || v.selectedAttrs.some((s) => s.valueId <= 0));
    if (invalid) { toast.error("Each variant must have at least one attribute with a value selected"); return; }
    setSaving(true);
    try {
      const created = await createItem({
        name: name.trim(),
        base_price: basePrice ? Number(basePrice) : null,
        description: description.trim() || null,
        is_active: active === "active",
      });
      const itemId = created.data.id;
      for (const d of drafts) {
        await createVariant({
          item_tmpl_id: itemId, name: variantName(d),
          uom_id: d.uom_id,
          list_price: d.listPrice ? Number(d.listPrice) : null,
          sku: d.sku.trim() || null,
          valueIds: d.selectedAttrs.map((s) => s.valueId),
        });
      }
      toast.success("Item created"); onSaved(); onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create item");
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader><DialogTitle>Create Item</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="create-name">Item Name *</Label>
            <Input id="create-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter item name" required className="w-full sm:max-w-md truncate min-w-0 overflow-hidden" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="create-basePrice">Base Price</Label>
            <Input id="create-basePrice" type="number" step="0.01" min="0" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} placeholder="0.00" className="w-full sm:max-w-[200px] min-w-0 overflow-hidden" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="create-description">Description</Label>
            <Textarea id="create-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" rows={3} className="w-full max-h-[120px] overflow-y-auto" style={{ overflowWrap: "anywhere" }} />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <RadioGroup value={active} onValueChange={setActive} className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="active" id="status-active" />
                <Label htmlFor="status-active" className="text-sm font-normal">Active</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="inactive" id="status-inactive" />
                <Label htmlFor="status-inactive" className="text-sm font-normal">Inactive</Label>
              </div>
            </RadioGroup>
          </div>
          <div className="border-t pt-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <Label>Variants</Label>
              <Button type="button" variant="outline" size="sm" onClick={() => { setAddVariants((p) => !p); if (addVariants) setVariants([]); }}>
                <Plus className="mr-1 h-4 w-4 shrink-0" />{addVariants ? "Remove Variants" : "Add Variants"}
              </Button>
            </div>
            {addVariants && variants.map((draft) => {
              const unselectedAttrs = attributes.filter((a) => !draft.selectedAttrs.some((s) => s.attrId === a.id));
              return (
                <div key={draft.key} className="space-y-3 rounded-md border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-muted-foreground truncate">Variant: {variantName(draft) || "—"}</p>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeVariant(draft.key)}><X className="h-4 w-4" /></Button>
                  </div>
                  {draft.selectedAttrs.map((sa) => {
                    const attr = attributes.find((a) => a.id === sa.attrId);
                    const options = attributeValues.filter((av) => Number(av.attribute_id) === sa.attrId);
                    return (
                      <div key={sa.attrId} className="flex items-end gap-2">
                        <div className="flex-1 min-w-0 space-y-1">
                          <p className="text-xs text-muted-foreground truncate">{attr?.name || "Unknown"}</p>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button type="button" variant="outline" role="combobox" className="w-full justify-between font-normal truncate min-w-0 max-w-full">
                                <span className="truncate min-w-0">{sa.valueId > 0 ? options.find((o) => o.id === sa.valueId)?.name || "Select value..." : "Select value..."}</span>
                                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start" onWheel={(e) => e.stopPropagation()}>
                              <Command>
                                <CommandInput placeholder="Search..." className="h-9" />
                                <CommandList className="max-h-[160px] overflow-y-auto">
                                  <CommandEmpty>No results</CommandEmpty>
                                  <CommandGroup>
                                    <CommandItem value="--none--" onSelect={() => changeValue(draft.key, sa.attrId, 0)}>
                                      <Check className={cn("mr-2 h-4 w-4", sa.valueId === 0 ? "opacity-100" : "opacity-0")} />-- None --
                                    </CommandItem>
                                    {options.map((opt) => (
                                      <CommandItem key={opt.id} value={opt.name || ""} onSelect={() => changeValue(draft.key, sa.attrId, opt.id)}>
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
                        <Button type="button" variant="ghost" size="icon" className="shrink-0 h-10 w-10" onClick={() => removeAttribute(draft.key, sa.attrId)}><X className="h-4 w-4" /></Button>
                      </div>
                    );
                  })}
                  {unselectedAttrs.length > 0 && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button type="button" variant="outline" size="sm" className="truncate min-w-0">
                          <Plus className="mr-1 h-4 w-4 shrink-0" /><span className="truncate">Add Attribute</span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="p-0 w-64" align="start">
                        <Command>
                          <CommandInput placeholder="Search attribute..." className="h-9" />
                          <CommandList className="max-h-[200px] overflow-y-auto" onWheel={(e) => e.stopPropagation()}>
                            <CommandEmpty>No results</CommandEmpty>
                            <CommandGroup>
                              {unselectedAttrs.map((attr) => (
                                <CommandItem key={attr.id} value={attr.name || ""} onSelect={() => addAttribute(draft.key, attr.id)}>
                                  <span className="truncate min-w-0">{attr.name}</span>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  )}
                  <div className="space-y-1">
                    <Label className="text-xs">UOM</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button type="button" variant="outline" role="combobox" className="w-full justify-between font-normal truncate min-w-0 max-w-full">
                          <span className="truncate min-w-0">
                            {(() => {
                              const sel = units.find((u) => u.unit_id === draft.uom_id);
                              return sel ? sel.unit_shortcut || sel.unit_name : "Select UOM...";
                            })()}
                          </span>
                          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start" onWheel={(e) => e.stopPropagation()}>
                        <Command>
                          <CommandInput placeholder="Search UOM..." className="h-9" />
                          <CommandList className="max-h-[160px] overflow-y-auto">
                            <CommandEmpty>No results</CommandEmpty>
                            <CommandGroup>
                              {units.map((u) => {
                                const value = u.unit_shortcut || u.unit_name;
                                return (
                                  <CommandItem key={u.unit_id} value={value} onSelect={() => updateVariant(draft.key, { uom_id: u.unit_id })} className="w-full">
                                    <Check className={cn("mr-2 h-4 w-4 shrink-0", draft.uom_id === u.unit_id ? "opacity-100" : "opacity-0")} />
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
                      <Input type="number" step="0.01" min="0" value={draft.listPrice} onChange={(e) => updateVariant(draft.key, { listPrice: e.target.value })} placeholder="0.00" className="min-w-0 overflow-hidden" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">SKU</Label>
                      <Input value={draft.sku} onChange={(e) => updateVariant(draft.key, { sku: e.target.value })} placeholder="SKU" className="min-w-0 overflow-hidden" />
                    </div>
                  </div>
                </div>
              );
            })}
            {addVariants && (
              <Button type="button" variant="outline" size="sm" onClick={addVariant}>
                <Plus className="mr-1 h-4 w-4 shrink-0" />Add Another Variant
              </Button>
            )}
          </div>
          <DialogFooter className="gap-2 pt-2">
            <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create Item
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
