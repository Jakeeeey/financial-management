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
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon, Loader2, Plus, Trash2 } from "lucide-react";
import { format, isValid } from "date-fns";
import { useRouter } from "next/navigation";
import { createPR, searchSuppliers, listItemTemplates, listItemVariants, listUnits } from "../providers/requestService";
import type { Supplier, ItemTemplate, ItemVariant, Unit, CreatePRItemInput } from "../utils/types";
import { formatPHP } from "../utils/format";
import { toast } from "sonner";

type LineItem = CreatePRItemInput & {
  _key: number;
  template_name?: string;
  variant_name?: string;
};

let _nextKey = 1;

export function RequestCreatePage() {
  const router = useRouter();
  const [leadDate, setLeadDate] = React.useState<Date>(new Date());
  const [lineItems, setLineItems] = React.useState<LineItem[]>([]);
  const [submitting, setSubmitting] = React.useState(false);
  const [units, setUnits] = React.useState<Unit[]>([]);
  React.useEffect(() => { listUnits().then(setUnits).catch(() => {}); }, []);

  const [supplierSearchText, setSupplierSearchText] = React.useState("");
  const [supplierItems, setSupplierItems] = React.useState<string[]>([]);
  const [selectedSupplier, setSelectedSupplier] = React.useState<Supplier | null>(null);
  const supplierDataRef = React.useRef<Record<string, Supplier>>({});

  const supplierFetchId = React.useRef(0);
  React.useEffect(() => {
    const id = ++supplierFetchId.current;
    const ac = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const rows = await searchSuppliers(supplierSearchText, ac.signal);
        if (!ac.signal.aborted && id === supplierFetchId.current) {
          const map: Record<string, Supplier> = {};
          rows.forEach((r) => { map[r.supplier_name] = r; });
          supplierDataRef.current = map;
          setSupplierItems(rows.map((r) => r.supplier_name));
        }
      } catch { /* ignore */ }
    }, 150);
    return () => { clearTimeout(timer); ac.abort(); };
  }, [supplierSearchText]);

  const [itemOpen, setItemOpen] = React.useState(false);
  const [itemSearchText, setItemSearchText] = React.useState("");
  const [itemTemplateItems, setItemTemplateItems] = React.useState<string[]>([]);
  const itemTemplateDataRef = React.useRef<Record<string, ItemTemplate>>({});
  const itemFetchId = React.useRef(0);

  React.useEffect(() => {
    const id = ++itemFetchId.current;
    const ac = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const rows = await listItemTemplates(itemSearchText ?? "", ac.signal);
        if (!ac.signal.aborted && id === itemFetchId.current) {
          const map: Record<string, ItemTemplate> = {};
          rows.forEach((r) => { map[r.name] = r; });
          itemTemplateDataRef.current = map;
          setItemTemplateItems(rows.map((r) => r.name));
        }
      } catch { /* ignore */ }
    }, 150);
    return () => { clearTimeout(timer); ac.abort(); };
  }, [itemSearchText, itemOpen]);

  const [variantOptions, setVariantOptions] = React.useState<Record<number, ItemVariant[]>>({});
  const [loadingVariant, setLoadingVariant] = React.useState<Record<number, boolean>>({});

  function addLine() {
    setLineItems((prev) => [
      {
        _key: _nextKey++,
        item_template_id: null,
        item_variant_id: null,
        uom: null,
        qty: 1,
        unit_price: 0,
      },
      ...prev,
    ]);
  }

  function removeLine(key: number) {
    setLineItems((prev) => prev.filter((li) => li._key !== key));
    setVariantOptions((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function updateLine(key: number, patch: Partial<LineItem>) {
    setLineItems((prev) => prev.map((li) => (li._key === key ? { ...li, ...patch } : li)));
  }

  async function handleSelectTemplate(lineKey: number, templateName: string | null) {
    if (!templateName) {
      updateLine(lineKey, { item_template_id: null, uom: null, unit_price: 0, template_name: undefined, item_variant_id: null, variant_name: undefined });
      setVariantOptions((prev) => { const next = { ...prev }; delete next[lineKey]; return next; });
      return;
    }
    const t = itemTemplateDataRef.current[templateName];
    if (!t) return;
    updateLine(lineKey, { item_template_id: t.id, uom: t.uom ?? null, unit_price: t.base_price ?? 0, template_name: t.name, item_variant_id: null, variant_name: undefined });
    setLoadingVariant((prev) => ({ ...prev, [lineKey]: true }));
    try {
      const variants = await listItemVariants(t.id);
      setVariantOptions((prev) => ({ ...prev, [lineKey]: variants || [] }));
      if (variants?.length === 1) {
        updateLine(lineKey, { item_variant_id: variants[0].id, variant_name: variants[0].name });
      }
    } catch { /* ignore */ }
    setLoadingVariant((prev) => ({ ...prev, [lineKey]: false }));
  }

  async function handleSubmit() {
    if (!selectedSupplier) { toast.error("Please select a supplier"); return; }
    if (!lineItems.length) { toast.error("Please add at least one item"); return; }
    for (const li of lineItems) {
      if (!li.item_template_id) { toast.error("Each item needs a template"); return; }
      if (String(li.qty).replace(/\D/g, "").length > 7) { toast.error("Qty cannot exceed 7 digits"); return; }
      if (String(li.unit_price).replace(/\D/g, "").length > 9) { toast.error("Unit price cannot exceed 9 digits"); return; }
      const upStr = String(li.unit_price);
      const decParts = upStr.split(".");
      if (decParts.length > 1 && decParts[1].length > 2) { toast.error("Unit price can only have 2 decimal places"); return; }
      if (String(Math.floor(li.qty * li.unit_price)).replace(/\D/g, "").length > 8) { toast.error("Line total exceeds maximum (decimal(10,2))"); return; }
    }
    const grandTotal = lineItems.reduce((s, li) => s + li.qty * li.unit_price, 0);
    if (String(Math.floor(grandTotal)).replace(/\D/g, "").length > 8) { toast.error("Grand total exceeds maximum (decimal(10,2))"); return; }
    setSubmitting(true);
    try {
      const result = await createPR({
        supplier_id: selectedSupplier.id,
        lead_date: format(leadDate, "yyyy-MM-dd"),
        encoder_id: 1,
        department_id: null,
        status: "pending",
        items: lineItems.map(({ _key, template_name, variant_name, ...item }) => {
          void _key; void template_name; void variant_name;
          return item;
        }),
      });
      toast.success(`Saved! Procurement #${result.procurement_no} created.`);
      router.push(`/fm/procurement/approval/${result.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create procurement");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-lg">Supplier Information</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:max-w-sm">
              <Label>Supplier</Label>
              <div className="mt-1.5">
                <Combobox items={supplierItems} value={selectedSupplier?.supplier_name ?? ""}
                  onValueChange={(name: string | null) => {
                    if (name) { const data = supplierDataRef.current[name]; setSelectedSupplier(data ?? null); }
                    else { setSelectedSupplier(null); setSupplierSearchText(""); }
                  }}
                >
                  <ComboboxInput placeholder="Search supplier..." showClear
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      setSupplierSearchText(e.target.value);
                      if (!e.target.value) setSelectedSupplier(null);
                    }}
                  />
                  <ComboboxContent>
                    <ComboboxEmpty>No suppliers found.</ComboboxEmpty>
                    <ComboboxList>{(name: string) => <ComboboxItem key={name} value={name}>{name}</ComboboxItem>}</ComboboxList>
                  </ComboboxContent>
                </Combobox>
              </div>
            </div>
            <div className="sm:max-w-sm sm:ml-auto">
              <Label>Lead Date</Label>
              <div className="mt-1.5">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {isValid(leadDate) ? format(leadDate, "MMM dd, yyyy") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={leadDate} onSelect={(d) => d && setLeadDate(d)} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
          {selectedSupplier && (
            <div className="rounded-md border bg-muted/30 p-3 text-sm grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              <div><span className="text-muted-foreground text-xs block">Type</span><span className="font-medium">{selectedSupplier.supplier_type ?? "\u2014"}</span></div>
              {selectedSupplier.email_address && <div><span className="text-muted-foreground text-xs block">Email</span><span className="truncate">{selectedSupplier.email_address}</span></div>}
              {selectedSupplier.phone_number && <div><span className="text-muted-foreground text-xs block">Phone</span><span>{selectedSupplier.phone_number}</span></div>}
              {selectedSupplier.tin_number && <div><span className="text-muted-foreground text-xs block">TIN</span><span className="font-mono text-xs">{selectedSupplier.tin_number}</span></div>}
              {selectedSupplier.payment_terms && <div><span className="text-muted-foreground text-xs block">Payment Terms</span><span>{selectedSupplier.payment_terms}</span></div>}
              {selectedSupplier.address && <div className="sm:col-span-2"><span className="text-muted-foreground text-xs block">Address</span><span className="truncate block">{selectedSupplier.address}</span></div>}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Line Items</CardTitle>
          <Button variant="outline" size="sm" onClick={addLine}><Plus className="h-4 w-4 mr-1" /> Add Line</Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {lineItems.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No items yet. Click &quot;Add Line&quot; to start.</p>}
          {lineItems.length > 0 && (
            <div className="rounded-md border overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-3 py-2 text-left font-medium min-w-[200px]">Item</th>
                    <th className="px-3 py-2 text-left font-medium min-w-[200px]">Variant</th>
                    <th className="px-3 py-2 text-left font-medium w-[1%] whitespace-nowrap min-w-[120px]">UOM</th>
                    <th className="px-3 py-2 text-right font-medium w-[1%] whitespace-nowrap min-w-[90px] max-w-[90px]">Qty</th>
                    <th className="px-3 py-2 text-right font-medium w-[1%] whitespace-nowrap min-w-[130px] max-w-[160px]">Unit Price</th>
                    <th className="px-3 py-2 text-right font-medium w-[1%] whitespace-nowrap min-w-[130px] max-w-[160px]">Total</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((line) => {
                    const hasVariants = line.item_template_id && variantOptions[line._key] !== undefined && variantOptions[line._key].length > 0;
                    return (
                    <tr key={line._key} className="border-b last:border-0">
                      <td className="px-3 py-2 max-w-[240px] min-w-[200px]">
                        <Combobox items={itemTemplateItems} value={line.template_name ?? ""}
                          onValueChange={(name: string | null) => handleSelectTemplate(line._key, name)}
                          onOpenChange={(open: boolean) => { setItemOpen(open); if (!open) setItemSearchText(""); }}
                        >
                          <ComboboxInput placeholder="Search item template..." showClear className="h-8 text-xs"
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setItemSearchText(e.target.value)}
                          />
                          <ComboboxContent>
                            <ComboboxEmpty>No templates.</ComboboxEmpty>
                            <ComboboxList>{(name: string) => <ComboboxItem key={name} value={name}><div>{name}</div></ComboboxItem>}</ComboboxList>
                          </ComboboxContent>
                        </Combobox>
                        {loadingVariant[line._key] && <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Loading variants...</div>}
                      </td>
                      <td className="px-3 py-2">
                        {hasVariants ? (
                          <Select value={line.variant_name ?? ""}
                            onValueChange={(v: string) => {
                              const vr = variantOptions[line._key].find((x) => x.name === v);
                              if (vr) updateLine(line._key, { item_variant_id: vr.id, variant_name: vr.name, unit_price: vr.list_price ?? line.unit_price });
                              else updateLine(line._key, { item_variant_id: null, variant_name: undefined });
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs w-full"><SelectValue placeholder="Select variant" /></SelectTrigger>
                            <SelectContent>
                              {variantOptions[line._key].map((vr) => <SelectItem key={vr.id} value={vr.name} className="text-xs">{vr.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        ) : <span className="text-xs text-muted-foreground">&mdash;</span>}
                      </td>
                      <td className="px-3 py-2">
                        <Select value={line.uom ?? ""} onValueChange={(v) => updateLine(line._key, { uom: v || null })}>
                          <SelectTrigger className="h-8 text-xs w-24"><SelectValue placeholder="UOM" /></SelectTrigger>
                            <SelectContent className="!max-h-[160px] overflow-y-auto" position="popper">{units.map((u) => <SelectItem key={u.unit_id} value={u.unit_shortcut ?? u.unit_name} className="text-xs">{u.unit_shortcut ?? u.unit_name}</SelectItem>)}</SelectContent>
                        </Select>
                      </td>
                    <td className="px-3 py-2 max-w-[90px]"><Input type="number" min="0" step="1" value={line.qty} onChange={(e) => { if (e.target.value.replace(/\D/g, "").length > 7) return; updateLine(line._key, { qty: Number(e.target.value) || 0 }); }} className="h-8 text-xs text-right" /></td>
                     <td className="px-3 py-2 max-w-[160px]"><Input type="number" min="0" step="0.01" value={line.unit_price} onChange={(e) => { if (e.target.value.replace(/\D/g, "").length > 9) return; updateLine(line._key, { unit_price: Number(e.target.value) || 0 }); }} className="h-8 w-24 text-xs text-right" /></td>
                        <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">{formatPHP(line.qty * line.unit_price)}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeLine(line._key)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                        </td>
                    </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t font-medium">
                    <td colSpan={5} className="px-3 py-2 text-right">Grand Total</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">{formatPHP(lineItems.reduce((s, li) => s + li.qty * li.unit_price, 0))}</td>
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
