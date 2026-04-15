"use client";

import * as React from "react";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

import * as api from "../providers/pcrApi";

type PriceTypeOption = { price_type_id: number; price_type_name?: string };
type ProductPriceField = "price_per_unit" | "priceA" | "priceB" | "priceC" | "priceD" | "priceE";

function safeInt(v: unknown): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
}

function safeStr(v: unknown): string {
    const s = String(v ?? "").trim();
    if (!s || s === "undefined" || s === "null") return "";
    return s;
}

function useDebouncedValue<T>(value: T, delayMs: number) {
    const [debounced, setDebounced] = React.useState(value);

    React.useEffect(() => {
        const t = window.setTimeout(() => setDebounced(value), delayMs);
        return () => window.clearTimeout(t);
    }, [value, delayMs]);

    return debounced;
}

function formatPHP(n: number | null | undefined) {
    if (n == null || !Number.isFinite(Number(n))) return "—";
    return Number(n).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function pickCurrentPriceField(priceTypeName?: string): ProductPriceField {
    const t = (priceTypeName || "").trim().toLowerCase();

    if (/\bprice\s*a\b/.test(t) || /\btier\s*a\b/.test(t) || t === "a" || t.endsWith(" a")) return "priceA";
    if (/\bprice\s*b\b/.test(t) || /\btier\s*b\b/.test(t) || t === "b" || t.endsWith(" b")) return "priceB";
    if (/\bprice\s*c\b/.test(t) || /\btier\s*c\b/.test(t) || t === "c" || t.endsWith(" c")) return "priceC";
    if (/\bprice\s*d\b/.test(t) || /\btier\s*d\b/.test(t) || t === "d" || t.endsWith(" d")) return "priceD";
    if (/\bprice\s*e\b/.test(t) || /\btier\s*e\b/.test(t) || t === "e" || t.endsWith(" e")) return "priceE";

    return "price_per_unit";
}

function toggleId(list: string[], id: string) {
    if (list.includes(id)) return list.filter((x) => x !== id);
    return [...list, id];
}

function supplierText(s: api.SupplierOption) {
    const shortcut = safeStr(s.supplier_shortcut);
    const name = safeStr(s.supplier_name);
    if (!name) return `Supplier #${s.id}`;
    return shortcut ? `${shortcut} — ${name}` : name;
}

export default function CreateRequestDialog(props: {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    priceTypes: PriceTypeOption[];
    onCreated: () => void;
}) {
    const [saving, setSaving] = React.useState(false);

    const [categories, setCategories] = React.useState<api.CategoryOption[]>([]);
    const [brands, setBrands] = React.useState<api.BrandOption[]>([]);
    const [units, setUnits] = React.useState<api.UnitOption[]>([]);
    const [suppliers, setSuppliers] = React.useState<api.SupplierOption[]>([]);

    const [supplierIds, setSupplierIds] = React.useState<string[]>([]);
    const supplierIdsKey = React.useMemo(() => supplierIds.join(","), [supplierIds]);
    const supplierFilterActive = supplierIds.length > 0;

    const [categoryId, setCategoryId] = React.useState<string>("");
    const [brandId, setBrandId] = React.useState<string>("");
    const [lookupLoading, setLookupLoading] = React.useState(false);

    const unitLabelById = React.useMemo(() => {
        const m = new Map<number, string>();
        for (const u of units) {
            const id = Number(u.unit_id);
            if (!Number.isFinite(id) || id <= 0) continue;
            const label = (u.unit_shortcut ?? u.unit_name ?? "—").toString();
            m.set(id, label);
        }
        return m;
    }, [units]);

    const [productId, setProductId] = React.useState<number | null>(null);
    const [selectedProduct, setSelectedProduct] = React.useState<api.ProductSearchRow | null>(null);

    const [productPickerOpen, setProductPickerOpen] = React.useState(false);
    const [productQuery, setProductQuery] = React.useState("");
    const debouncedProductQuery = useDebouncedValue(productQuery, 250);

    const [productLoading, setProductLoading] = React.useState(false);
    const [productOptions, setProductOptions] = React.useState<api.ProductSearchRow[]>([]);

    const [priceTypeId, setPriceTypeId] = React.useState<string>("");
    const [proposedPrice, setProposedPrice] = React.useState<string>("");

    const selectedPriceType = React.useMemo(() => {
        const id = safeInt(priceTypeId);
        return props.priceTypes.find((p) => Number(p.price_type_id) === id) ?? null;
    }, [priceTypeId, props.priceTypes]);

    const currentPrice = React.useMemo(() => {
        if (!selectedProduct || !selectedPriceType) return null;
        const field = pickCurrentPriceField(selectedPriceType.price_type_name);
        const value = selectedProduct[field];
        const n = Number(value);
        return Number.isFinite(n) ? n : null;
    }, [selectedProduct, selectedPriceType]);

    const selectedUomLabel = React.useMemo(() => {
        const id = selectedProduct?.unit_of_measurement ?? null;
        if (!id) return "—";
        return unitLabelById.get(Number(id)) ?? "—";
    }, [selectedProduct, unitLabelById]);

    React.useEffect(() => {
        if (!props.open) {
            setSaving(false);

            setCategories([]);
            setBrands([]);
            setUnits([]);
            setSuppliers([]);

            setSupplierIds([]);

            setCategoryId("");
            setBrandId("");
            setLookupLoading(false);

            setProductId(null);
            setSelectedProduct(null);
            setProductPickerOpen(false);
            setProductQuery("");
            setProductOptions([]);
            setProductLoading(false);

            setPriceTypeId("");
            setProposedPrice("");
        }
    }, [props.open]);

    React.useEffect(() => {
        if (!props.open) return;

        let alive = true;

        const run = async () => {
            setLookupLoading(true);
            try {
                const supplier_ids = supplierIds.length ? supplierIdsKey : undefined;

                const res = await api.getLookups(
                    supplier_ids
                        ? {
                            supplier_scope: "LINKED_ONLY",
                            supplier_ids,
                            category_id: safeInt(categoryId) > 0 ? safeInt(categoryId) : null,
                            brand_id: safeInt(brandId) > 0 ? safeInt(brandId) : null,
                        }
                        : {
                            category_id: safeInt(categoryId) > 0 ? safeInt(categoryId) : null,
                            brand_id: safeInt(brandId) > 0 ? safeInt(brandId) : null,
                        },
                );

                if (!alive) return;

                const nextCategories = res.categories;
                const nextBrands = res.brands;

                setCategories(nextCategories);
                setBrands(nextBrands);
                setUnits(res.units);
                setSuppliers(res.suppliers ?? []);

                if (categoryId && !nextCategories.some((c) => String(c.category_id) === String(categoryId))) {
                    setCategoryId("");
                }
                if (brandId && !nextBrands.some((b) => String(b.brand_id) === String(brandId))) {
                    setBrandId("");
                }
            } catch (error: unknown) {
                toast.error(error instanceof Error ? error.message : "Failed to load lookups");
            } finally {
                if (!alive) return;
                setLookupLoading(false);
            }
        };

        run();

        return () => {
            alive = false;
        };
    }, [props.open, supplierIds, supplierIdsKey, categoryId, brandId]);

    React.useEffect(() => {
        if (!props.open) return;
        setProductId(null);
        setSelectedProduct(null);
    }, [props.open, categoryId, brandId, supplierIdsKey]);

    const canSave =
        (productId ?? 0) > 0 &&
        safeInt(priceTypeId) > 0 &&
        proposedPrice.trim() !== "" &&
        Number.isFinite(Number(proposedPrice));

    React.useEffect(() => {
        if (!props.open) return;

        const q = (debouncedProductQuery ?? "").trim();

        if (!supplierFilterActive && q.length < 1) {
            setProductOptions([]);
            return;
        }

        const effectiveQ = q;
        let alive = true;

        const run = async () => {
            setProductLoading(true);
            try {
                const supplier_ids = supplierFilterActive ? supplierIdsKey : undefined;

                const rows = await api.searchProducts({
                    q: effectiveQ,
                    limit: 25,
                    category_id: safeInt(categoryId) > 0 ? safeInt(categoryId) : null,
                    brand_id: safeInt(brandId) > 0 ? safeInt(brandId) : null,
                    supplier_scope: supplierFilterActive ? "LINKED_ONLY" : "ALL",
                    supplier_ids,
                });

                if (!alive) return;
                setProductOptions(rows);
            } catch {
                if (!alive) return;
                setProductOptions([]);
            } finally {
                if (!alive) return;
                setProductLoading(false);
            }
        };

        if (supplierFilterActive || q.length >= 1) run();
        else setProductOptions([]);

        return () => {
            alive = false;
        };
    }, [props.open, debouncedProductQuery, categoryId, brandId, supplierIdsKey, supplierFilterActive]);

    const onSubmit = async () => {
        if (!canSave || !productId) {
            toast.error("Please fill all fields correctly.");
            return;
        }

        setSaving(true);
        try {
            await api.createRequest({
                product_id: productId,
                price_type_id: safeInt(priceTypeId),
                proposed_price: Number(proposedPrice),
            });
            toast.success("Request created.");
            props.onOpenChange(false);
            props.onCreated();
        } catch (error: unknown) {
            toast.error(error instanceof Error ? error.message : "Failed to create request");
        } finally {
            setSaving(false);
        }
    };

    const selectedLabel = selectedProduct
        ? `${selectedProduct.product_name} (${selectedUomLabel}) (ID: ${selectedProduct.product_id})`
        : "Select product…";

    const [supplierOpen, setSupplierOpen] = React.useState(false);
    const [supplierQuery, setSupplierQuery] = React.useState("");

    const filteredSuppliers = React.useMemo(() => {
        const q = supplierQuery.trim().toLowerCase();
        if (!q) return suppliers;
        return suppliers.filter((s) => supplierText(s).toLowerCase().includes(q) || String(s.id).includes(q));
    }, [supplierQuery, suppliers]);

    return (
        <Dialog open={props.open} onOpenChange={props.onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>New Price Change Request</DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="space-y-2 rounded-lg border p-3">
                        <Label>Suppliers</Label>

                        <Popover open={supplierOpen} onOpenChange={setSupplierOpen}>
                            <PopoverTrigger asChild>
                                <Button variant="outline" type="button" className="h-10 w-full justify-between">
                                    <span className="truncate text-left">
                                        {supplierIds.length ? `Suppliers (${supplierIds.length}) • Linked` : "Select suppliers…"}
                                    </span>
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>

                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                                <Command shouldFilter={false}>
                                    <div className="flex items-center gap-2 px-2 pt-2">
                                        <CommandInput placeholder="Search supplier…" value={supplierQuery} onValueChange={setSupplierQuery} />
                                        {supplierIds.length > 0 ? (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8"
                                                onClick={() => setSupplierIds([])}
                                                title="Clear suppliers"
                                                type="button"
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        ) : null}
                                    </div>

                                    <CommandList>
                                        <CommandEmpty>No suppliers found.</CommandEmpty>

                                        <CommandGroup heading="Suppliers">
                                            {filteredSuppliers.slice(0, 120).map((s) => {
                                                const idStr = String(s.id);
                                                const label = supplierText(s);
                                                const selected = supplierIds.includes(idStr);

                                                return (
                                                    <CommandItem
                                                        key={s.id}
                                                        value={`${label} ${idStr}`}
                                                        onSelect={() => setSupplierIds((prev) => toggleId(prev, idStr))}
                                                    >
                                                        <Check className={cn("mr-2 h-4 w-4", selected ? "opacity-100" : "opacity-0")} />
                                                        <span className="truncate">{label}</span>
                                                    </CommandItem>
                                                );
                                            })}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>

                        <div className="text-xs text-muted-foreground">
                            Selecting supplier(s) will automatically show <b>linked</b> Categories/Brands/UOM and Products.
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="grid gap-2">
                            <Label>Category</Label>
                            <select
                                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                                value={categoryId}
                                onChange={(e) => setCategoryId(e.target.value)}
                                disabled={lookupLoading}
                            >
                                <option value="">{lookupLoading ? "Loading…" : "All Categories"}</option>
                                {categories.map((c) => (
                                    <option key={c.category_id} value={String(c.category_id)}>
                                        {c.category_name}
                                    </option>
                                ))}
                            </select>
                            {supplierFilterActive ? (
                                <div className="text-[11px] text-muted-foreground">Scoped by supplier(s).</div>
                            ) : null}
                        </div>

                        <div className="grid gap-2">
                            <Label>Brand</Label>
                            <select
                                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                                value={brandId}
                                onChange={(e) => setBrandId(e.target.value)}
                                disabled={lookupLoading}
                            >
                                <option value="">{lookupLoading ? "Loading…" : "All Brands"}</option>
                                {brands.map((b) => (
                                    <option key={b.brand_id} value={String(b.brand_id)}>
                                        {b.brand_name}
                                    </option>
                                ))}
                            </select>
                            {supplierFilterActive ? (
                                <div className="text-[11px] text-muted-foreground">Scoped by supplier(s).</div>
                            ) : null}
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label>Product</Label>

                        <Popover open={productPickerOpen} onOpenChange={setProductPickerOpen}>
                            <PopoverTrigger asChild>
                                <Button variant="outline" type="button" role="combobox" className="h-10 w-full justify-between">
                                    <span className="truncate text-left">{selectedLabel}</span>
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>

                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                                <Command shouldFilter={false}>
                                    <CommandInput
                                        placeholder={
                                            supplierFilterActive
                                                ? "Optional: refine search (name / code / barcode)..."
                                                : "Search product by name / code / barcode…"
                                        }
                                        value={productQuery}
                                        onValueChange={setProductQuery}
                                    />
                                    <CommandList>
                                        {productLoading ? (
                                            <div className="px-3 py-2 text-sm text-muted-foreground">Loading…</div>
                                        ) : (
                                            <>
                                                <CommandEmpty>No products found.</CommandEmpty>
                                                <CommandGroup>
                                                    {productOptions.map((p) => {
                                                        const isSelected = selectedProduct?.product_id === p.product_id;
                                                        const uom = p.unit_of_measurement
                                                            ? unitLabelById.get(Number(p.unit_of_measurement)) ?? "—"
                                                            : "—";

                                                        return (
                                                            <CommandItem
                                                                key={p.product_id}
                                                                value={String(p.product_id)}
                                                                onSelect={() => {
                                                                    setSelectedProduct(p);
                                                                    setProductId(p.product_id);
                                                                    setProductPickerOpen(false);
                                                                }}
                                                            >
                                                                <Check className={cn("mr-2 h-4 w-4", isSelected ? "opacity-100" : "opacity-0")} />
                                                                <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                                                                    <div className="min-w-0">
                                                                        <div className="truncate">{p.product_name}</div>
                                                                        <div className="text-xs text-muted-foreground">
                                                                            {uom} • #{p.product_id}
                                                                        </div>
                                                                    </div>
                                                                    <span className="shrink-0 rounded-md border px-2 py-0.5 text-xs text-muted-foreground">
                                                                        {uom}
                                                                    </span>
                                                                </div>
                                                            </CommandItem>
                                                        );
                                                    })}
                                                </CommandGroup>
                                            </>
                                        )}
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>

                        <div className="text-xs text-muted-foreground">
                            {supplierFilterActive ? (
                                <>Linked products are shown automatically. You can type to refine.</>
                            ) : (
                                <>Tip: select supplier first (linked), then pick product.</>
                            )}
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label>Price Type</Label>
                        <select
                            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                            value={priceTypeId}
                            onChange={(e) => setPriceTypeId(e.target.value)}
                        >
                            <option value="">Select…</option>
                            {props.priceTypes.map((p) => (
                                <option key={p.price_type_id} value={String(p.price_type_id)}>
                                    {p.price_type_name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="grid gap-2">
                        <Label>Current Price (PHP)</Label>
                        <input
                            className="h-10 w-full rounded-md border bg-muted px-3 text-sm text-foreground"
                            value={selectedProduct && selectedPriceType ? formatPHP(currentPrice) : "—"}
                            readOnly
                        />
                        <div className="text-xs text-muted-foreground">Auto-fetched based on selected Product + Price Type.</div>
                    </div>

                    <div className="grid gap-2">
                        <Label>Proposed Price (PHP)</Label>
                        <input
                            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                            value={proposedPrice}
                            onChange={(e) => setProposedPrice(e.target.value)}
                            placeholder="0.00"
                            inputMode="decimal"
                        />
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" onClick={() => props.onOpenChange(false)} disabled={saving}>
                            Cancel
                        </Button>
                        <Button onClick={onSubmit} disabled={saving || !canSave}>
                            {saving ? "Saving..." : "Create"}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}