"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { createPR } from "../providers/prService";
import { searchSuppliers, listItemTemplates, listItemVariants } from "../providers/lookupsService";
import type { Supplier, ItemTemplate, ItemVariant, CreatePRItemInput } from "../utils/types";
import { formatPHP } from "../utils/format";
import { toast } from "sonner";

type LineItem = CreatePRItemInput & {
  _key: number;
  template_name?: string;
  variant_name?: string;
};

let _nextKey = 1;

export function ProcurementRequestCreatePage() {
  const router = useRouter();
  const [leadDate, setLeadDate] = React.useState(() => new Date().toISOString().split("T")[0]);
  const [lineItems, setLineItems] = React.useState<LineItem[]>([]);
  const [submitting, setSubmitting] = React.useState(false);

  /* Supplier combobox */
  const [supplierSearchText, setSupplierSearchText] = React.useState("");
  const [supplierItems, setSupplierItems] = React.useState<string[]>([]);
  const [selectedSupplier, setSelectedSupplier] = React.useState<Supplier | null>(null);
  const supplierDataRef = React.useRef<Record<string, Supplier>>({});

  React.useEffect(() => {
    if (!supplierSearchText.trim()) { setSupplierItems([]); return; }
    const ac = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const rows = await searchSuppliers(supplierSearchText, ac.signal);
        if (!ac.signal.aborted) {
          const map: Record<string, Supplier> = {};
          rows.forEach((r) => { map[r.supplier_name] = r; });
          supplierDataRef.current = map;
          setSupplierItems(rows.map((r) => r.supplier_name));
        }
      } catch { /* ignore */ }
    }, 300);
    return () => { clearTimeout(timer); ac.abort(); };
  }, [supplierSearchText]);

  /* Item template combos per line */
  const [itemSearchText, setItemSearchText] = React.useState("");
  const [itemTemplateItems, setItemTemplateItems] = React.useState<string[]>([]);
  const itemTemplateDataRef = React.useRef<Record<string, ItemTemplate>>({});

  React.useEffect(() => {
    if (!itemSearchText.trim()) { setItemTemplateItems([]); return; }
    const ac = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const rows = await listItemTemplates(itemSearchText, ac.signal);
        if (!ac.signal.aborted) {
          const map: Record<string, ItemTemplate> = {};
          rows.forEach((r) => { map[r.name] = r; });
          itemTemplateDataRef.current = map;
          setItemTemplateItems(rows.map((r) => r.name));
        }
      } catch { /* ignore */ }
    }, 300);
    return () => { clearTimeout(timer); ac.abort(); };
  }, [itemSearchText]);

  function addLine() {
    setLineItems((prev) => [
      {
        _key: _nextKey++,
        item_template_id: null,
        item_variant_id: null,
        item_name: "",
        item_description: null,
        uom: null,
        qty: 1,
        unit_price: 0,
      },
      ...prev,
    ]);
  }
        _key: _nextKey++,
        item_template_id: null,
        item_variant_id: null,
        item_name: "",
        item_description: null,
        uom: null,
        qty: 1,
        unit_price: 0,
      },
    ]);
  }

  function removeLine(key: number) {
    setLineItems((prev) => prev.filter((li) => li._key !== key));
  }

  function updateLine(key: number, patch: Partial<LineItem>) {
    setLineItems((prev) => prev.map((li) => (li._key === key ? { ...li, ...patch } : li)));
  }

  function handleSelectTemplate(lineKey: number, templateName: string | null) {
    if (!templateName) return;
    const t = itemTemplateDataRef.current[templateName];
    if (!t) return;
    updateLine(lineKey, {
      item_template_id: t.id,
      item_name: t.name,
      item_description: t.description ?? null,
      uom: t.uom ?? null,
      unit_price: t.base_price ?? 0,
      template_name: t.name,
      item_variant_id: null,
      variant_name: undefined,
    });
  }

  async function handleSubmit() {
    if (!selectedSupplier) {
      toast.error("Please select a supplier");
      return;
    }
    if (!lineItems.length) {
      toast.error("Please add at least one item");
      return;
    }

    setSubmitting(true);
    try {
      const result = await createPR({
        supplier_id: selectedSupplier.id,
        lead_date: leadDate,
        encoder_id: 1, // will be resolved server-side
        department_id: null,
        transaction_type: selectedSupplier.supplier_type?.includes("TRADE") ? "trade" : "non-trade",
        status: "pending",
        items: lineItems.map(({ _key, template_name, variant_name, ...item }) => item),
      });
      toast.success(`Saved! Procurement #${result.procurement_no} created.`);
      router.push(`/fm/procurement/procurement-request/${result.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create procurement");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Supplier Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Supplier</Label>
            <div className="mt-1.5">
              <Combobox
                items={supplierItems}
                value={selectedSupplier?.supplier_name ?? ""}
                onValueChange={(name: string | null) => {
                  if (name) {
                    const data = supplierDataRef.current[name];
                    setSelectedSupplier(data ?? null);
                  } else {
                    setSelectedSupplier(null);
                    setSupplierSearchText("");
                  }
                }}
              >
                <ComboboxInput
                  placeholder="Search supplier..."
                  showClear
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    setSupplierSearchText(e.target.value);
                    if (!e.target.value) setSelectedSupplier(null);
                  }}
                />
                <ComboboxContent>
                  <ComboboxEmpty>No suppliers found.</ComboboxEmpty>
                  <ComboboxList>
                    {(name: string) => (
                      <ComboboxItem key={name} value={name}>
                        {name}
                      </ComboboxItem>
                    )}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
            </div>
          </div>

          {selectedSupplier && (
            <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Type</span>
                <span className="font-medium">{selectedSupplier.supplier_type ?? "\u2014"}</span>
              </div>
              {selectedSupplier.email_address && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email</span>
                  <span>{selectedSupplier.email_address}</span>
                </div>
              )}
              {selectedSupplier.phone_number && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Phone</span>
                  <span>{selectedSupplier.phone_number}</span>
                </div>
              )}
              {selectedSupplier.tin_number && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">TIN</span>
                  <span className="font-mono text-xs">{selectedSupplier.tin_number}</span>
                </div>
              )}
              {selectedSupplier.payment_terms && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Payment Terms</span>
                  <span>{selectedSupplier.payment_terms}</span>
                </div>
              )}
              {selectedSupplier.address && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Address</span>
                  <span className="text-right max-w-[250px]">{selectedSupplier.address}</span>
                </div>
              )}
            </div>
          )}

          <div className="max-w-[240px]">
            <Label>Lead Date</Label>
            <Input
              type="date"
              value={leadDate}
              onChange={(e) => setLeadDate(e.target.value)}
              className="mt-1.5"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Line Items</CardTitle>
          <Button variant="outline" size="sm" onClick={addLine}>
            <Plus className="h-4 w-4 mr-1" /> Add Line
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {lineItems.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              No items yet. Click "Add Line" to start.
            </p>
          )}

          {lineItems.length > 0 && (
            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-3 py-2 text-left font-medium">Template</th>
                    <th className="px-3 py-2 text-left font-medium">Item Name</th>
                    <th className="px-3 py-2 text-left font-medium">UOM</th>
                    <th className="px-3 py-2 text-right font-medium">Qty</th>
                    <th className="px-3 py-2 text-right font-medium">Unit Price</th>
                    <th className="px-3 py-2 text-right font-medium">Total</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((line) => (
                    <tr key={line._key} className="border-b last:border-0">
                      <td className="px-3 py-2">
                        <Combobox
                          items={itemTemplateItems}
                          value={line.template_name ?? ""}
                          onValueChange={(name: string | null) => {
                            handleSelectTemplate(line._key, name);
                          }}
                        >
                          <ComboboxInput
                            placeholder="Select template..."
                            showClear
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                              setItemSearchText(e.target.value)
                            }
                          />
                          <ComboboxContent>
                            <ComboboxEmpty>No templates.</ComboboxEmpty>
                            <ComboboxList>
                              {(name: string) => (
                                <ComboboxItem key={name} value={name}>
                                  <div className="font-medium">{name}</div>
                                </ComboboxItem>
                              )}
                            </ComboboxList>
                          </ComboboxContent>
                        </Combobox>
                        {line.item_template_id && (
                          <div className="mt-1 flex gap-1">
                            <Select
                              onValueChange={(v) => {
                                const variantId = Number(v);
                                if (variantId) {
                                  updateLine(line._key, {
                                    item_variant_id: variantId,
                                    variant_name: v,
                                  });
                                } else {
                                  updateLine(line._key, {
                                    item_variant_id: null,
                                    variant_name: undefined,
                                  });
                                }
                              }}
                            >
                              <SelectTrigger className="h-7 text-xs">
                                <SelectValue placeholder="Variant" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="">— No variant —</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          placeholder="Item name"
                          value={line.item_name}
                          onChange={(e) => updateLine(line._key, { item_name: e.target.value })}
                          className="h-8 text-xs"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          placeholder="UOM"
                          value={line.uom ?? ""}
                          onChange={(e) => updateLine(line._key, { uom: e.target.value || null })}
                          className="h-8 text-xs w-20"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          value={line.qty}
                          onChange={(e) => updateLine(line._key, { qty: Number(e.target.value) || 0 })}
                          className="h-8 text-xs w-20 text-right"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.unit_price}
                          onChange={(e) => updateLine(line._key, { unit_price: Number(e.target.value) || 0 })}
                          className="h-8 text-xs w-24 text-right"
                        />
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">
                        {formatPHP(line.qty * line.unit_price)}
                      </td>
                      <td className="px-3 py-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeLine(line._key)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t font-medium">
                    <td colSpan={5} className="px-3 py-2 text-right">Grand Total</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      {formatPHP(lineItems.reduce((s, li) => s + li.qty * li.unit_price, 0))}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => router.back()}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Submit Procurement Request
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
