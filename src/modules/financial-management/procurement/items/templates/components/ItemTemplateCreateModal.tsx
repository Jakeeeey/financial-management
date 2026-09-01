"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { createTemplate, listUnits } from "../providers/item-template-service";
import type { Unit } from "../utils/types";

interface ItemTemplateCreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function ItemTemplateCreateModal({ open, onOpenChange, onSaved }: ItemTemplateCreateModalProps) {
  const [name, setName] = useState("");
  const [uom, setUom] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [description, setDescription] = useState("");
  const [active, setActive] = useState(true);
  const [units, setUnits] = useState<Unit[]>([]);
  const [saving, setSaving] = useState(false);
  const [uomOpen, setUomOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName("");
    setUom("");
    setBasePrice("");
    setDescription("");
    setActive(true);
    setUomOpen(false);
    listUnits()
      .then((res) => setUnits(res.data || []))
      .catch(() => {});
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Item name is required");
      return;
    }

    setSaving(true);
    try {
      await createTemplate({
        name: name.trim(),
        uom: uom || null,
        base_price: basePrice ? Number(basePrice) : null,
        description: description.trim() || null,
        is_active: active,
      });
      toast.success("Template created");
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create template");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>Create Item Template</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="create-name">Item Name *</Label>
            <Input
              id="create-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter item name"
              required
              className="w-full sm:max-w-md truncate min-w-0 overflow-hidden"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-uom">Unit of Measure</Label>
            <Popover open={uomOpen} onOpenChange={setUomOpen}>
              <PopoverTrigger asChild>
                <Button
                  id="create-uom"
                  variant="outline"
                  role="combobox"
                  className="w-full max-w-[80vw] sm:max-w-md justify-between px-3 font-normal min-w-0 overflow-hidden"
                >
                  <span className="truncate min-w-0">
                    {uom || "Select UOM..."}
                  </span>
                  <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="max-w-md p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search UOM..." className="h-9" />
                  <CommandList
                    className="max-h-[200px] overflow-y-auto"
                    onWheel={(e) => e.stopPropagation()}
                  >
                    <CommandEmpty>No results</CommandEmpty>
                    <CommandGroup>
                      {units.map((u) => {
                        const value = u.unit_shortcut || u.unit_name;
                        return (
                          <CommandItem
                            key={u.unit_id}
                            value={value}
                            onSelect={() => {
                              setUom(value);
                              setUomOpen(false);
                            }}
                            className="w-full"
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4 shrink-0",
                                uom === value ? "opacity-100" : "opacity-0"
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

          <div className="space-y-2">
            <Label htmlFor="create-basePrice">Base Price</Label>
            <Input
              id="create-basePrice"
              type="number"
              step="0.01"
              min="0"
              value={basePrice}
              onChange={(e) => setBasePrice(e.target.value)}
              placeholder="0.00"
              className="w-full sm:max-w-[200px] min-w-0 overflow-hidden"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-description">Description</Label>
            <Textarea
              id="create-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={3}
              className="w-full max-h-[120px] overflow-y-auto"
              style={{ overflowWrap: "anywhere" }}
            />
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="template-active"
                  checked={active}
                  onChange={() => setActive(true)}
                  className="h-4 w-4"
                />
                <span className="text-sm">Active</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="template-active"
                  checked={!active}
                  onChange={() => setActive(false)}
                  className="h-4 w-4"
                />
                <span className="text-sm">Inactive</span>
              </label>
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Template
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}