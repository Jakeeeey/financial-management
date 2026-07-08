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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Plus, Trash2, Search } from "lucide-react";
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

  const [supplierQuery, setSupplierQuery] = React.useState("");
  const [suppliers, setSuppliers] = React.useState<Supplier[]>([]);
  const [selectedSupplier, setSelectedSupplier] = React.useState<Supplier | null>(null);
  const [showSupplierDropdown, setShowSupplierDropdown] = React.useState(false);
  const [leadDate, setLeadDate] = React.useState(() => new Date().toISOString().split("T")[0]);
  const [lineItems, setLineItems] = React.useState<LineItem[]>([]);
  const [submitting, setSubmitting] = React.useState(false);

  const [itemQuery, setItemQuery] = React.useState("");
  const [itemTemplates, setItemTemplates] = React.useState<ItemTemplate[]>([]);
  const [showItemDropdown, setShowItemDropdown] = React.useState(false);
  const itemDropdownRef = React.useRef<HTMLDivElement>(null);

  const supplierSearchRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!supplierQuery.trim()) { setSuppliers([]); return; }
    const ac = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const results = await searchSuppliers(supplierQuery, ac.signal);
        if (!ac.signal.aborted) {
          setSuppliers(results);
          setShowSupplierDropdown(results.length > 0);
        }
      } catch { /* ignore */ }
    }, 300);
    return () => { clearTimeout(timer); ac.abort(); };
  }, [supplierQuery]);

  React.useEffect(() => {
    if (!itemQuery.trim()) { setItemTemplates([]); return; }
    const ac = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const results = await listItemTemplates(itemQuery, ac.signal);
        if (!ac.signal.aborted) {
          setItemTemplates(results);
          setShowItemDropdown(results.length > 0);
        }
      } catch { /* ignore */ }
    }, 300);
    return () => { clearTimeout(timer); ac.abort(); };
  }, [itemQuery]);

  React.useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (supplierSearchRef.current && !supplierSearchRef.current.contains(e.target as Node)) {
        setShowSupplierDropdown(false);
      }
      if (itemDropdownRef.current && !itemDropdownRef.current.contains(e.target as Node)) {
        setShowItemDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function addLine() {
    setLineItems((prev) => [
      ...prev,
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
    ]);
  }

  function removeLine(key: number) {
    setLineItems((prev) => prev.filter((li) => li._key !== key));
  }

  function updateLine(key: number, patch: Partial<LineItem>) {
    setLineItems((prev) => prev.map((li) => (li._key === key ? { ...li, ...patch } : li)));
  }

  async function handleSelectTemplate(item: ItemTemplate) {
    setItemQuery(item.name);
    setShowItemDropdown(false);
    const existingLine = lineItems.find((li) => li._key === lineItems.length);
    if (existingLine) {
      updateLine(existingLine._key, {
        item_template_id: item.id,
        item_name: item.name,
        item_description: item.description,
        uom: item.uom,
        unit_price: item.base_price ?? 0,
        template_name: item.name,
      });
    }
  }

  function handleSelectVariant(lineKey: number, variant: ItemVariant) {
    updateLine(lineKey, {
      item_variant_id: variant.id,
      unit_price: variant.list_price ?? 0,
      variant_name: variant.name,
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
          <div ref={supplierSearchRef} className="relative">
            <Label>Search Supplier</Label>
            <div className="relative mt-1.5">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Type supplier name..."
                value={supplierQuery}
                onChange={(e) => { setSupplierQuery(e.target.value); setSelectedSupplier(null); }}
              />
            </div>
            {showSupplierDropdown && (
              <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-md max-h-[200px] overflow-auto">
                {suppliers.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors"
                    onClick={() => {
                      setSelectedSupplier(s);
                      setSupplierQuery(s.supplier_name);
                      setShowSupplierDropdown(false);
                    }}
                  >
                    <div className="font-medium">{s.supplier_name}</div>
                    {s.supplier_type && (
                      <div className="text-xs text-muted-foreground">{s.supplier_type}</div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedSupplier && (
            <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Type</span>
                <span className="font-medium">{selectedSupplier.supplier_type ?? "—"}</span>
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
                    <th className="px-3 py-2 text-left font-medium">Item</th>
                    <th className="px-3 py-2 text-left font-medium">Description</th>
                    <th className="px-3 py-2 text-left font-medium">UOM</th>
                    <th className="px-3 py-2 text-right font-medium">Qty</th>
                    <th className="px-3 py-2 text-right font-medium">Unit Price</th>
                    <th className="px-3 py-2 text-right font-medium">Total</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((line, idx) => (
                    <tr key={line._key} className="border-b last:border-0">
                      <td className="px-3 py-2">
                        <div ref={idx === lineItems.length - 1 ? itemDropdownRef : undefined} className="relative">
                          <Input
                            placeholder="Search item..."
                            value={idx === lineItems.length - 1 ? itemQuery : line.item_name}
                            onChange={(e) => {
                              if (idx === lineItems.length - 1) {
                                setItemQuery(e.target.value);
                              }
                              updateLine(line._key, { item_name: e.target.value });
                            }}
                            className="h-8 text-xs"
                          />
                          {idx === lineItems.length - 1 && showItemDropdown && (
                            <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-md max-h-[150px] overflow-auto">
                              {itemTemplates.map((t) => (
                                <button
                                  key={t.id}
                                  type="button"
                                  className="w-full px-2 py-1.5 text-left text-xs hover:bg-accent transition-colors"
                                  onClick={() => handleSelectTemplate(t)}
                                >
                                  <div className="font-medium">{t.name}</div>
                                  {t.uom && <span className="text-muted-foreground">{t.uom}</span>}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        {line.item_template_id && (
                          <div className="mt-1 flex gap-1">
                            <Select
                              onValueChange={(v) => {
                                const variantId = Number(v);
                                if (variantId) {
                                  const v = itemTemplates.find((t) => t.id === line.item_template_id);
                                  // variant lookup would go here
                                }
                              }}
                            >
                              <SelectTrigger className="h-7 text-xs">
                                <SelectValue placeholder="Variant" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="">-- No variant --</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          placeholder="Description"
                          value={line.item_description ?? ""}
                          onChange={(e) => updateLine(line._key, { item_description: e.target.value || null })}
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
                    <td colSpan={4} className="px-3 py-2 text-right">Grand Total</td>
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
