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
import { getVariantById, updateVariant, listTemplatesLookup } from "../providers/item-variant-service";

interface ItemVariantEditPageProps {
  id: number;
}

export default function ItemVariantEditPage({ id }: ItemVariantEditPageProps) {
  const router = useRouter();
  const [templateId, setTemplateId] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [name, setName] = useState("");
  const [listPrice, setListPrice] = useState("");
  const [sku, setSku] = useState("");
  const [active, setActive] = useState(true);
  const [templates, setTemplates] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);

  useEffect(() => {
    listTemplatesLookup()
      .then((res) => setTemplates((res.data || []).map((t: { id: number; name: string }) => ({ id: Number(t.id), name: t.name || "" }))))
      .catch(() => {});

    getVariantById(id)
      .then((res) => {
        const v = res.data;
        setTemplateId(String(v.item_tmpl_id ?? ""));
        setTemplateName(v._template_name ?? "");
        setName(v.name || "");
        setListPrice(v.list_price != null ? String(v.list_price) : "");
        setSku(v.sku || "");
        setActive(v.active !== false && v.active !== 0);
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : "Failed to load variant");
        router.push("/fm/procurement/items/variants");
      })
      .finally(() => setLoading(false));
  }, [id, router]);

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
      await updateVariant(Number(id), {
        item_tmpl_id: Number(templateId),
        name: name.trim(),
        list_price: listPrice ? Number(listPrice) : null,
        sku: sku.trim() || null,
        active,
      });
      toast.success("Variant updated");
      router.push("/fm/procurement/items/variants");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update variant");
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
        <div className="flex items-center gap-4 max-w-full">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 shrink-0" />
          </Button>
          <h1 className="text-xl font-semibold tracking-tight truncate max-w-[min(70vw,500px)]">{name}</h1>
        </div>

      <form onSubmit={handleSubmit} className="max-w-xl space-y-5">
        <div className="space-y-2">
          <Label htmlFor="template">Template *</Label>
          <Combobox
            open={templatesOpen}
            onOpenChange={setTemplatesOpen}
            items={templates.map((t) => t.name || String(t.id))}
          >
            <ComboboxInput
              placeholder="Search template..."
              className="w-full sm:max-w-md"
              value={templateName}
              onChange={(val) => {
                const v = (val.target as HTMLInputElement).value;
                setTemplateName(v);
                const t = templates.find((x) => x.name === v || String(x.id) === v);
                if (t) {
                  setTemplateId(String(t.id));
                  setTemplatesOpen(false);
                }
              }}
            />
            <ComboboxContent className="!max-h-[160px] !overflow-y-auto">
              <ComboboxEmpty>No results</ComboboxEmpty>
              <ComboboxList>
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
          <Label htmlFor="name">Variant Name *</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Office Chair - Black - Leather"
            required
            className="w-full sm:max-w-md min-w-0 overflow-hidden"
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
            className="w-full sm:max-w-[200px] min-w-0 overflow-hidden"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="sku">SKU</Label>
          <Input
            id="sku"
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            placeholder="Optional stock keeping unit"
            className="w-full sm:max-w-md min-w-0 overflow-hidden"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="active">Status</Label>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="active"
                checked={active}
                onChange={() => setActive(true)}
                className="h-4 w-4"
              />
              <span className="text-sm">Active</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="active"
                checked={!active}
                onChange={() => setActive(false)}
                className="h-4 w-4"
              />
              <span className="text-sm">Inactive</span>
            </label>
          </div>
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
