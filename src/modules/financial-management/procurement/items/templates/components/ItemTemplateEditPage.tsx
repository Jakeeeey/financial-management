"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Loader2 } from "lucide-react";
import { getTemplateById, updateTemplate, listUnits } from "../providers/item-template-service";
import type { Unit } from "../utils/types";

interface ItemTemplateEditPageProps {
  id: number;
}

export default function ItemTemplateEditPage({ id }: ItemTemplateEditPageProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [uom, setUom] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [description, setDescription] = useState("");
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listUnits().then((res) => setUnits(res.data || [])).catch(() => {});
    getTemplateById(id)
      .then((res) => {
        const t = res.data;
        setName(t.name || "");
        setUom(t.uom || "");
        setBasePrice(t.base_price != null ? String(t.base_price) : "");
        setDescription(t.description || "");
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : "Failed to load template");
        router.push("/fm/procurement/items/templates");
      })
      .finally(() => setLoading(false));
  }, [id, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Item name is required");
      return;
    }

    setSaving(true);
    try {
      await updateTemplate(id, {
        name: name.trim(),
        uom: uom || null,
        base_price: basePrice ? Number(basePrice) : null,
        description: description.trim() || null,
      });
      toast.success("Template updated");
      router.push("/fm/procurement/items/templates");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update template");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-xl font-semibold tracking-tight truncate max-w-[min(70vw,500px)]">{name}</h1>
      </div>

      <form onSubmit={handleSubmit} className="max-w-xl space-y-5">
        <div className="space-y-2">
          <Label htmlFor="name">Item Name *</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter item name"
            required
            className="w-full sm:max-w-md"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="uom">Unit of Measure</Label>
          <Select value={uom} onValueChange={setUom}>
            <SelectTrigger id="uom" className="h-9">
              <SelectValue placeholder="Select UOM" />
            </SelectTrigger>
            <SelectContent className="!max-h-[160px] !overflow-y-auto">
              {units.map((u) => (
                <SelectItem key={u.unit_id} value={u.unit_shortcut || u.unit_name}>
                  {u.unit_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="basePrice">Base Price</Label>
          <Input
            id="basePrice"
            type="number"
            step="0.01"
            min="0"
            value={basePrice}
            onChange={(e) => setBasePrice(e.target.value)}
            placeholder="0.00"
            className="w-full sm:max-w-[200px]"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description"
            rows={3}
            className="w-full sm:max-w-lg max-h-[120px] overflow-y-auto overflow-wrap-anywhere"
          />
        </div>

        <div className="flex gap-3">
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
