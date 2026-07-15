"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { createVariant, listTemplatesLookup } from "../providers/item-variant-service";
import type { ItemVariant } from "../utils/types";

export default function ItemVariantCreatePage() {
  const router = useRouter();
  const [templateId, setTemplateId] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [name, setName] = useState("");
  const [listPrice, setListPrice] = useState("");
  const [sku, setSku] = useState("");
  const [templates, setTemplates] = useState<ItemVariant[]>([]);
  const [saving, setSaving] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);

  useEffect(() => {
    listTemplatesLookup()
      .then((res) => setTemplates((res.data || []) as unknown as ItemVariant[]))
      .catch(() => toast.error("Failed to load templates"));
  }, []);

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
        sku: sku.trim() || null,
      });
      toast.success("Variant created");
      router.push("/fm/procurement/items/variants");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create variant");
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
        <h1 className="text-xl font-semibold tracking-tight">Create Item Variant</h1>
      </div>

      <form onSubmit={handleSubmit} className="max-w-xl space-y-5">
        <div className="space-y-2">
          <Label htmlFor="template">Template *</Label>
          <Combobox
            open={templatesOpen}
            onOpenChange={setTemplatesOpen}
            items={templates.map((t) => String(t.id))}
          >
            <ComboboxInput
              placeholder="Search template..."
              className="w-full sm:max-w-md"
              displayValue={(val) => {
                if (val === templateId) return templateName;
                const t = templates.find((x) => String(x.id) === val);
                return t?.name ?? (templates.find((x) => String(x.id) === templateId)?.name ?? "");
              }}
              value={templateId}
              onChange={(val) => {
                setTemplateId(val);
                const t = templates.find((x) => String(x.id) === val);
                setTemplateName(t?.name ?? "");
                setTemplatesOpen(false);
              }}
            />
            <ComboboxContent>
              <ComboboxEmpty>No results</ComboboxEmpty>
              <ComboboxList>
                {(item) => (
                  <ComboboxItem key={item} value={item}>
                    {templates.find((t) => String(t.id) === item)?.name ?? item}
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        </div>

        <div className="space-y-2">
          <Label htmlFor="name">Variant Name *</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Office Chair - Black - Leather"
            required
            className="w-full sm:max-w-md"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="listPrice">List Price</Label>
          <Input
            id="listPrice"
            type="number"
            step="0.01"
            min="0"
            value={listPrice}
            onChange={(e) => setListPrice(e.target.value)}
            placeholder="0.00"
            className="w-full sm:max-w-[200px]"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="sku">SKU</Label>
          <Input
            id="sku"
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            placeholder="Optional stock keeping unit"
            className="w-full sm:max-w-md"
          />
        </div>

        <div className="flex gap-3">
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Variant
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
