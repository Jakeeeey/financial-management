"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { ArrowLeft, Loader2 } from "lucide-react";
import { createTemplate, listUnits } from "../providers/item-template-service";
import type { Unit } from "../utils/types";

export default function ItemTemplateCreatePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [uom, setUom] = useState("");
  const [uomText, setUomText] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [description, setDescription] = useState("");
  const [units, setUnits] = useState<Unit[]>([]);
  const [saving, setSaving] = useState(false);
  const [uomOpen, setUomOpen] = useState(false);

  useEffect(() => {
    listUnits().then((res) => setUnits(res.data || [])).catch(() => {});
  }, []);

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
      });
      toast.success("Template created");
      router.push("/fm/procurement/items/templates");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create template");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-xl font-semibold tracking-tight truncate max-w-[400px]">Create Item Template</h1>
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
            className="w-full sm:max-w-md min-w-0 overflow-hidden"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="uom">Unit of Measure</Label>
          <Combobox
            open={uomOpen}
            onOpenChange={(open) => {
              setUomOpen(open);
              if (!open) {
                if (units.some((u) => (u.unit_shortcut || u.unit_name) === uomText)) {
                  setUom(uomText);
                } else {
                  setUomText(uom);
                }
              }
            }}
            value={uom || null}
            onValueChange={(v) => {
              setUom(v ?? "");
              setUomText(v ?? "");
            }}
            items={units.map((u) => u.unit_shortcut || u.unit_name)}
          >
            <ComboboxInput
              id="uom"
              placeholder="Search UOM..."
              className="w-full sm:max-w-[200px]"
              value={uomText}
              onChange={(val) => {
                setUomText((val.target as HTMLInputElement).value);
              }}
            />
            <ComboboxContent className="[scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <ComboboxEmpty>No results</ComboboxEmpty>
              <ComboboxList className="!max-h-[160px]">
                {(item) => (
                  <ComboboxItem key={item} value={item}>
                    {item}
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
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
            className="w-full sm:max-w-[200px] min-w-0 overflow-hidden"
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
            className="w-full sm:max-w-lg max-h-[120px] overflow-y-auto"
            style={{ overflowWrap: "anywhere" }}
          />
        </div>

        <div className="flex gap-3">
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Template
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
