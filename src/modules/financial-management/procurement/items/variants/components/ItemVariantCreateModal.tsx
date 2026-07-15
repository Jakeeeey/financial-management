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
import { Check, ChevronDown, Loader2, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { createVariant, listTemplatesLookup, listAttributes, listAttributeValues } from "../providers/item-variant-service";
import type { ItemTemplateLookup, ItemAttribute, ItemAttributeValue } from "../utils/types";

interface ItemVariantCreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function ItemVariantCreateModal({ open, onOpenChange, onSaved }: ItemVariantCreateModalProps) {
  const [templateId, setTemplateId] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [name, setName] = useState("");
  const [listPrice, setListPrice] = useState("");
  const [templates, setTemplates] = useState<ItemTemplateLookup[]>([]);
  const [attributes, setAttributes] = useState<ItemAttribute[]>([]);
  const [attributeValues, setAttributeValues] = useState<ItemAttributeValue[]>([]);
  const [selectedAttrs, setSelectedAttrs] = useState<{ attrId: number; valueId: number }[]>([]);
  const [saving, setSaving] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [attrOpen, setAttrOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTemplateId("");
    setTemplateName("");
    setName("");
    setListPrice("");
    setSelectedAttrs([]);
    listTemplatesLookup()
      .then((res) => setTemplates(res.data || []))
      .catch(() => toast.error("Failed to load templates"));
    listAttributes()
      .then((res) => setAttributes(res.data || []))
      .catch(() => {});
    listAttributeValues()
      .then((res) => setAttributeValues(res.data || []))
      .catch(() => {});
  }, [open]);

  const selectedValueIds = useCallback(
    () => selectedAttrs.filter((a) => a.valueId > 0).map((a) => a.valueId),
    [selectedAttrs]
  );

  // Auto-generate variant name from template + selected attribute values
  useEffect(() => {
    const tpl = templates.find((t) => String(t.id) === templateId);
    if (!tpl) {
      setName("");
      return;
    }
    const vals = selectedAttrs
      .map((a) => attributeValues.find((av) => av.id === a.valueId))
      .filter((v): v is ItemAttributeValue => v !== undefined)
      .map((v) => v.name);
    setName([tpl.name, ...vals].filter(Boolean).join(" ").trim());
  }, [templateId, selectedAttrs, templates, attributeValues]);

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
    if (!templateId) {
      toast.error("Please select a template");
      return;
    }
    if (!name.trim()) {
      toast.error("Variant name is required");
      return;
    }

    setSaving(true);
    try {
      await createVariant({
        item_tmpl_id: Number(templateId),
        name: name.trim(),
        list_price: listPrice ? Number(listPrice) : null,
        valueIds: selectedValueIds(),
      });
      toast.success("Variant created");
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create variant");
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
          <DialogTitle className="truncate">Create Item Variant</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label>Template *</Label>
            <Popover open={templateOpen} onOpenChange={setTemplateOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full max-w-[80vw] sm:max-w-md justify-between px-3 font-normal min-w-0 overflow-hidden"
                >
                  <span className="truncate min-w-0">
                    {templateName || "Select template..."}
                  </span>
                  <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="max-w-md p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search template..." className="h-9" />
                  <CommandList className="max-h-[200px] overflow-y-auto" onWheel={(e) => e.stopPropagation()}>
                    <CommandEmpty>No results</CommandEmpty>
                    <CommandGroup>
                      {templates.map((t) => (
                        <CommandItem
                          key={t.id}
                          value={t.name || ""}
                          onSelect={() => {
                            setTemplateId(String(t.id));
                            setTemplateName(t.name || "");
                            setSelectedAttrs([]);
                            setTemplateOpen(false);
                          }}
                          className="w-full"
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4 shrink-0",
                              templateId === String(t.id) ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <span className="truncate min-w-0">{t.name || "(unnamed)"}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
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
            <Label htmlFor="create-listPrice">List Price</Label>
            <Input
              id="create-listPrice"
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
            <Label>Attribute Assignments</Label>
            <div className="space-y-3">
              {selectedAttrs.map((sa) => {
                const attr = attributes.find((a) => a.id === sa.attrId);
                const options = attributeValues.filter(
                  (av) => Number(av.attribute_id) === sa.attrId
                );
                return (
                  <div key={sa.attrId} className="flex items-end gap-2">
                    <div className="flex-1 min-w-0 w-full max-w-[70vw] sm:max-w-[25.5rem] space-y-1">
                      <p className="text-xs text-muted-foreground truncate">{attr?.name || "Unknown"}</p>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
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
                          className="p-0 w-[--radix-popover-trigger-width]"
                          align="start"
                          onWheel={(e) => e.stopPropagation()}
                        >
                          <Command>
                            <CommandInput placeholder="Search..." className="h-9" />
                            <CommandList className="max-h-[160px] overflow-y-auto">
                              <CommandEmpty>No results</CommandEmpty>
                              <CommandGroup>
                                <CommandItem
                                  value="--none--"
                                  onSelect={() => handleValueChange(sa.attrId, 0)}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      sa.valueId === 0 ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  -- None --
                                </CommandItem>
                                {options.map((opt) => (
                                  <CommandItem
                                    key={opt.id}
                                    value={opt.name || ""}
                                    onSelect={() => handleValueChange(sa.attrId, opt.id)}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        sa.valueId === opt.id ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    <span className="truncate min-w-0">
                                      {opt.name}
                                      {opt.extra_price && Number(opt.extra_price) > 0
                                        ? ` ( +${opt.extra_price} )`
                                        : ""}
                                    </span>
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
                    <Button type="button" variant="outline" size="sm" className="mt-1 truncate min-w-0">
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

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Variant
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
