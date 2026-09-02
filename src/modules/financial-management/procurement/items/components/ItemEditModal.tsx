"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
  getItemById,
  updateItem,
} from "@/modules/financial-management/procurement/items/providers/itemService";

interface ItemEditModalProps {
  id: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function ItemEditModal({ id, open, onOpenChange, onSaved }: ItemEditModalProps) {
  const [name, setName] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [description, setDescription] = useState("");
  const [active, setActive] = useState("active");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setName("");
    setBasePrice("");
    setDescription("");
    setActive("active");
    getItemById(id)
      .then((res) => {
        const t = res.data;
        setName(t.name || "");
        setBasePrice(t.base_price != null ? String(t.base_price) : "");
        setDescription(t.description || "");
        setActive(t.is_active === false || t.is_active === 0 ? "inactive" : "active");
      })
      .catch((err) => {
        console.error("[ItemEditModal] load item", err);
        toast.error(err instanceof Error ? err.message : "Failed to load item");
      })
      .finally(() => setLoading(false));
  }, [id, open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Item name is required");
      return;
    }
    setSaving(true);
    try {
      await updateItem(id, {
        name: name.trim(),
        base_price: basePrice ? Number(basePrice) : null,
        description: description.trim() || null,
        is_active: active === "active",
      });
      toast.success("Item updated");
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update item");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="truncate">Edit Item</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Item Name *</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter item name"
                required
                className="w-full sm:max-w-md truncate min-w-0 overflow-hidden"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-basePrice">Base Price</Label>
              <Input
                id="edit-basePrice"
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
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
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
              <RadioGroup
                value={active}
                onValueChange={setActive}
                className="flex items-center gap-4"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="active" id="edit-active" />
                  <Label htmlFor="edit-active" className="text-sm font-normal">Active</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="inactive" id="edit-inactive" />
                  <Label htmlFor="edit-inactive" className="text-sm font-normal">Inactive</Label>
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
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}