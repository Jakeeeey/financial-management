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
import { Check, ChevronDown, Loader2 } from "lucide-react";
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
  const [selectedValueIds, setSelectedValueIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [searchText, setSearchText] = useState("");

  useEffect(() => {
    if (!open) return;
    setTemplateId("");
    setTemplateName("");
    setName("");
    setListPrice("");
    setSelectedValueIds([]);
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

  // Auto-generate variant name from template + selected attribute values
  useEffect(() => {
    const tpl = templates.find((t) => String(t.id) === templateId);
    if (!tpl) {
      setName("");
      return;
    }
    const vals = selectedValueIds
      .map((vid) => attributeValues.find((av) => av.id === vid))
      .filter((v): v is ItemAttributeValue => v !== undefined)
      .map((v) => v.name);
    setName([tpl.name, ...vals].filter(Boolean).join(" ").trim());
  }, [templateId, selectedValueIds, templates, attributeValues]);

  const attributeList = attributes.filter(
    (a) => selectedValueIds.some((vid) => {
      const av = attributeValues.find((v) => v.id === vid);
      return Number(av?.attribute_id) === a.id;
    }) || !selectedValueIds.length
  );

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
        valueIds: selectedValueIds.filter(Boolean),
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
                  className="w-full sm:max-w-md justify-between px-3 font-normal min-w-0 overflow-hidden"
                >
                  <span className="truncate">
                    {templateName || "Select template..."}
                  </span>
                  <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="sm:max-w-lg p-0" align="start">
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
                            setSelectedValueIds([]);
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
              className="w-full sm:max-w-md min-w-0 overflow-hidden bg-muted text-muted-foreground cursor-not-allowed"
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
                  <SelectTrigger className="w-full sm:max-w-md min-w-0 overflow-hidden">
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
