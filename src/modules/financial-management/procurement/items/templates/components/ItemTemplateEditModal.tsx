"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import {
  getTemplateById,
  updateTemplate,
  listUnits,
} from "../providers/item-template-service";
import type { Unit } from "../utils/types";

interface ItemTemplateEditModalProps {
  id: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function ItemTemplateEditModal({
  id,
  open,
  onOpenChange,
  onSaved,
}: ItemTemplateEditModalProps) {
  const [name, setName] = useState("");
  const [uom, setUom] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [description, setDescription] = useState("");
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || id == null) return;
    setLoading(true);
    setName("");
    setUom("");
    setBasePrice("");
    setDescription("");
    listUnits()
      .then((res) => setUnits(res.data || []))
      .catch(() => {});
    getTemplateById(id)
      .then((res) => {
        const t = res.data;
        setName(t.name || "");
        setUom(t.uom || "");
        setBasePrice(t.base_price != null ? String(t.base_price) : "");
        setDescription(t.description || "");
      })
      .catch((err) => {
        toast.error(
          err instanceof Error ? err.message : "Failed to load template"
        );
      })
      .finally(() => setLoading(false));
  }, [id, open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Item name is required");
      return;
    }
    if (id == null) return;

    setSaving(true);
    try {
      await updateTemplate(id, {
        name: name.trim(),
        uom: uom || null,
        base_price: basePrice ? Number(basePrice) : null,
        description: description.trim() || null,
      });
      toast.success("Template updated");
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update template"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>Edit Template</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="modal-name">Item Name *</Label>
              <Input
                id="modal-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter item name"
                required
                className="w-full sm:max-w-md truncate min-w-0 overflow-hidden"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="modal-uom">Unit of Measure</Label>
              <Select value={uom} onValueChange={setUom}>
                <SelectTrigger id="modal-uom" className="h-9 w-full sm:max-w-md min-w-0 overflow-hidden">
                  <SelectValue placeholder="Select UOM" />
                </SelectTrigger>
                <SelectContent className="!max-h-[200px] !overflow-y-auto" position="popper">
                  {units.map((u) => (
                    <SelectItem
                      key={u.unit_id}
                      value={u.unit_shortcut || u.unit_name}
                    >
                      {u.unit_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="modal-basePrice">Base Price</Label>
              <Input
                id="modal-basePrice"
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
              <Label htmlFor="modal-description">Description</Label>
              <Textarea
                id="modal-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
                rows={3}
                className="w-full max-h-[120px] overflow-y-auto"
                style={{ overflowWrap: "anywhere" }}
              />
            </div>

            <DialogFooter className="gap-2 pt-2">
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={saving}>
                {saving && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
