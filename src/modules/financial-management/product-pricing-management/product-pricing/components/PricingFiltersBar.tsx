// src/modules/supply-chain-management/product-pricing-management/product-pricing/components/PricingFiltersBar.tsx
"use client";

import * as React from "react";
import type { Brand, Category, PriceType, PricingFilters, Supplier, Unit } from "../types";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";

import { Check, ChevronsUpDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
    filters: PricingFilters;
    setFilters: React.Dispatch<React.SetStateAction<PricingFilters>>;
    resetFilters: () => void;

    categories: Category[];
    brands: Brand[];
    units: Unit[];
    suppliers: Supplier[];
    priceTypes: PriceType[];
};

type FilterArrayKey = "category_ids" | "brand_ids" | "unit_ids" | "supplier_ids" | "price_type_ids";

function safeStr(v: unknown): string {
    const s = String(v ?? "").trim();
    if (!s || s === "undefined" || s === "null") return "";
    return s;
}

function supplierText(s: Supplier): string {
    const shortcut = safeStr(s.supplier_shortcut);
    const name = safeStr(s.supplier_name);
    const id = safeStr(s.id) || "0";

    if (!name) return `Supplier #${id}`;
    return shortcut ? `${shortcut} — ${name}` : name;
}

function unitText(u: Unit): string {
    const shortcut = safeStr(u.unit_shortcut);
    const name = safeStr(u.unit_name);
    return shortcut || name || "—";
}

function getIds(filters: PricingFilters, arrayKey: FilterArrayKey): string[] {
    return filters[arrayKey].map((item) => String(item));
}

function toNumericIds(ids: string[]): number[] {
    return ids
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id) && id > 0);
}

function setIds(
    setFilters: Props["setFilters"],
    arrayKey: FilterArrayKey,
    ids: string[],
) {
    setFilters((prev) => {
        const numericIds = toNumericIds(ids);

        const next: PricingFilters = {
            ...prev,
            [arrayKey]: numericIds,
        } as PricingFilters;

        if (arrayKey === "supplier_ids") {
            next.supplier_scope = numericIds.length > 0 ? "LINKED_ONLY" : "ALL";
        }

        return next;
    });
}

function toggleId(list: string[], id: string): string[] {
    if (list.includes(id)) return list.filter((x) => x !== id);
    return [...list, id];
}

function labelCount(title: string, count: number, emptyLabel: string): string {
    if (count <= 0) return emptyLabel;
    return `${title} (${count})`;
}

export default function PricingFiltersBar(props: Props) {
    const { filters, setFilters, resetFilters, categories, brands, units, suppliers, priceTypes } = props;

    const selectedSupplierIds = React.useMemo(
        () => getIds(filters, "supplier_ids"),
        [filters],
    );
    const selectedBrandIds = React.useMemo(
        () => getIds(filters, "brand_ids"),
        [filters],
    );
    const selectedCategoryIds = React.useMemo(
        () => getIds(filters, "category_ids"),
        [filters],
    );
    const selectedUnitIds = React.useMemo(
        () => getIds(filters, "unit_ids"),
        [filters],
    );
    const selectedPriceTypeIds = React.useMemo(
        () => getIds(filters, "price_type_ids"),
        [filters],
    );

    const [localQ, setLocalQ] = React.useState(filters.q);
    const [supplierOpen, setSupplierOpen] = React.useState(false);
    const [brandOpen, setBrandOpen] = React.useState(false);
    const [catOpen, setCatOpen] = React.useState(false);
    const [unitOpen, setUnitOpen] = React.useState(false);
    const [ptOpen, setPtOpen] = React.useState(false);

    const [supplierQuery, setSupplierQuery] = React.useState("");
    const [brandQuery, setBrandQuery] = React.useState("");
    const [catQuery, setCatQuery] = React.useState("");
    const [unitQuery, setUnitQuery] = React.useState("");
    const [ptQuery, setPtQuery] = React.useState("");

    React.useEffect(() => {
        setLocalQ(filters.q);
    }, [filters.q]);

    const filteredSuppliers = React.useMemo(() => {
        const q = supplierQuery.trim().toLowerCase();
        if (!q) return suppliers;

        return suppliers.filter((s) => {
            const idStr = safeStr(s.id);
            return supplierText(s).toLowerCase().includes(q) || idStr.includes(q);
        });
    }, [supplierQuery, suppliers]);

    const filteredBrands = React.useMemo(() => {
        const q = brandQuery.trim().toLowerCase();
        if (!q) return brands;

        return brands.filter((b) => {
            const name = safeStr(b.brand_name).toLowerCase();
            const idStr = safeStr(b.brand_id);
            return name.includes(q) || idStr.includes(q);
        });
    }, [brandQuery, brands]);

    const filteredCategories = React.useMemo(() => {
        const q = catQuery.trim().toLowerCase();
        if (!q) return categories;

        return categories.filter((c) => {
            const name = safeStr(c.category_name).toLowerCase();
            const idStr = safeStr(c.category_id);
            return name.includes(q) || idStr.includes(q);
        });
    }, [catQuery, categories]);

    const filteredUnits = React.useMemo(() => {
        const q = unitQuery.trim().toLowerCase();
        if (!q) return units;

        return units.filter((u) => {
            const idStr = safeStr(u.unit_id);
            return unitText(u).toLowerCase().includes(q) || idStr.includes(q);
        });
    }, [unitQuery, units]);

    const supplierLabelById = React.useMemo(() => {
        const map = new Map<string, string>();
        for (const s of suppliers) {
            const id = safeStr(s.id);
            if (id) map.set(id, supplierText(s));
        }
        return map;
    }, [suppliers]);

    const brandLabelById = React.useMemo(() => {
        const map = new Map<string, string>();
        for (const b of brands) {
            const id = safeStr(b.brand_id);
            const label = safeStr(b.brand_name) || "—";
            if (id) map.set(id, label);
        }
        return map;
    }, [brands]);

    const categoryLabelById = React.useMemo(() => {
        const map = new Map<string, string>();
        for (const c of categories) {
            const id = safeStr(c.category_id);
            const label = safeStr(c.category_name) || "—";
            if (id) map.set(id, label);
        }
        return map;
    }, [categories]);

    const unitLabelById = React.useMemo(() => {
        const map = new Map<string, string>();
        for (const u of units) {
            const id = safeStr(u.unit_id);
            const label = unitText(u);
            if (id) map.set(id, label);
        }
        return map;
    }, [units]);
    
    const priceTypeLabelById = React.useMemo(() => {
        const map = new Map<string, string>();
        for (const pt of priceTypes) {
            const id = safeStr(pt.price_type_id);
            const label = safeStr(pt.price_type_name) || "—";
            if (id) map.set(id, label);
        }
        return map;
    }, [priceTypes]);

    const chips: Array<{ key: string; label: string; onRemove: () => void }> = [];

    const q = safeStr(filters.q);
    if (q) {
        chips.push({
            key: `q:${q}`,
            label: `Search: ${q}`,
            onRemove: () => setFilters((prev) => ({ ...prev, q: "" })),
        });
    }

    for (const id of selectedSupplierIds) {
        const label = supplierLabelById.get(id) ?? `Supplier #${id}`;
        chips.push({
            key: `s:${id}`,
            label,
            onRemove: () =>
                setIds(setFilters, "supplier_ids", selectedSupplierIds.filter((x) => x !== id)),
        });
    }

    for (const id of selectedBrandIds) {
        const label = brandLabelById.get(id) ?? `Brand #${id}`;
        chips.push({
            key: `b:${id}`,
            label,
            onRemove: () =>
                setIds(setFilters, "brand_ids", selectedBrandIds.filter((x) => x !== id)),
        });
    }

    for (const id of selectedCategoryIds) {
        const label = categoryLabelById.get(id) ?? `Category #${id}`;
        chips.push({
            key: `c:${id}`,
            label,
            onRemove: () =>
                setIds(setFilters, "category_ids", selectedCategoryIds.filter((x) => x !== id)),
        });
    }

    for (const id of selectedUnitIds) {
        const label = unitLabelById.get(id) ?? `UOM #${id}`;
        chips.push({
            key: `u:${id}`,
            label,
            onRemove: () =>
                setIds(setFilters, "unit_ids", selectedUnitIds.filter((x) => x !== id)),
        });
    }

    for (const id of selectedPriceTypeIds) {
        const label = priceTypeLabelById.get(id) ?? `Price #${id}`;
        chips.push({
            key: `pt:${id}`,
            label: `Price ${label}`,
            onRemove: () =>
                setIds(setFilters, "price_type_ids", selectedPriceTypeIds.filter((x) => x !== id)),
        });
    }

    if (filters.active_only) {
        chips.push({
            key: "active_only",
            label: "Active only",
            onRemove: () => setFilters((prev) => ({ ...prev, active_only: false })),
        });
    }

    if (filters.missing_tier) {
        chips.push({
            key: "missing_tier",
            label: "Missing tier",
            onRemove: () => setFilters((prev) => ({ ...prev, missing_tier: false })),
        });
    }

    if (filters.show_list_price) {
        chips.push({
            key: "show_list_price",
            label: "List Price",
            onRemove: () => setFilters((prev) => ({ ...prev, show_list_price: false })),
        });
    }

    return (
        <Card className="flex flex-col gap-3 rounded-2xl p-4 shadow-sm">
            {/* Top Row: Search & Primary Filters */}
            <div className="flex flex-col gap-3 lg:flex-row">
                {/* Search */}
                <div className="relative w-full shrink-0 lg:w-[340px]">
                    <Input
                        placeholder="Search name / code / barcode…"
                        value={localQ}
                        onChange={(e) => setLocalQ(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                e.preventDefault();
                                setFilters((prev) => ({ ...prev, q: localQ }));
                            }
                        }}
                        className="pr-10 shadow-none"
                    />
                    <Button
                        type="button"
                        onClick={() => setFilters((prev) => ({ ...prev, q: localQ }))}
                        size="icon"
                        title="Search"
                        className="absolute right-1 top-1 h-8 w-8 bg-emerald-500 text-white hover:bg-emerald-600"
                    >
                        <Search className="h-4 w-4" />
                    </Button>
                </div>

                {/* Primary Filters (Wrap on smaller screens, stick to rest of width) */}
                <div className="flex flex-1 flex-wrap items-center gap-2">
                    <div className="min-w-[160px] flex-1">
                        <Popover open={supplierOpen} onOpenChange={setSupplierOpen}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    className="w-full justify-between whitespace-nowrap shadow-none"
                                    type="button"
                                >
                                    <span className="truncate">
                                        {labelCount("Suppliers", selectedSupplierIds.length, "Supplier")}
                                        {selectedSupplierIds.length ? " • Linked" : ""}
                                    </span>
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-60" />
                                </Button>
                            </PopoverTrigger>

                            <PopoverContent className="w-[380px] p-0" align="start">
                                <Command shouldFilter={false}>
                                    <div className="flex items-center gap-2 px-2 pt-2">
                                        <CommandInput
                                            placeholder="Search supplier…"
                                            value={supplierQuery}
                                            onValueChange={setSupplierQuery}
                                        />
                                        {selectedSupplierIds.length > 0 ? (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8"
                                                onClick={() => setIds(setFilters, "supplier_ids", [])}
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
                                                const idStr = safeStr(s.id);
                                                const label = supplierText(s);
                                                const selected = selectedSupplierIds.includes(idStr);

                                                return (
                                                    <CommandItem
                                                        key={idStr}
                                                        value={`${label} ${idStr}`}
                                                        onSelect={() =>
                                                            setIds(
                                                                setFilters,
                                                                "supplier_ids",
                                                                toggleId(selectedSupplierIds, idStr),
                                                            )
                                                        }
                                                    >
                                                        <Check
                                                            className={cn(
                                                                "mr-2 h-4 w-4",
                                                                selected ? "opacity-100" : "opacity-0",
                                                            )}
                                                        />
                                                        <span className="truncate">{label}</span>
                                                    </CommandItem>
                                                );
                                            })}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>

                                <div className="border-t px-3 py-2 text-xs text-muted-foreground">
                                    Selecting supplier(s) will automatically show linked products only.
                                </div>
                            </PopoverContent>
                        </Popover>
                    </div>

                    <div className="min-w-[160px] flex-1">
                        <Popover open={brandOpen} onOpenChange={setBrandOpen}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    className="w-full justify-between whitespace-nowrap shadow-none"
                                    type="button"
                                >
                                    <span className="truncate">
                                        {labelCount("Brands", selectedBrandIds.length, "All brands")}
                                    </span>
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-60" />
                                </Button>
                            </PopoverTrigger>

                            <PopoverContent className="w-[340px] p-0" align="start">
                                <Command shouldFilter={false}>
                                    <div className="flex items-center gap-2 px-2 pt-2">
                                        <CommandInput
                                            placeholder="Search brand…"
                                            value={brandQuery}
                                            onValueChange={setBrandQuery}
                                        />
                                        {selectedBrandIds.length > 0 ? (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8"
                                                onClick={() => setIds(setFilters, "brand_ids", [])}
                                                title="Clear brands"
                                                type="button"
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        ) : null}
                                    </div>

                                    <CommandList>
                                        <CommandEmpty>No brands found.</CommandEmpty>
                                        <CommandGroup heading="Brands">
                                            {filteredBrands.slice(0, 140).map((b) => {
                                                const idStr = safeStr(b.brand_id);
                                                const label = safeStr(b.brand_name) || "—";
                                                const selected = selectedBrandIds.includes(idStr);

                                                return (
                                                    <CommandItem
                                                        key={idStr}
                                                        value={`${label} ${idStr}`}
                                                        onSelect={() =>
                                                            setIds(
                                                                setFilters,
                                                                "brand_ids",
                                                                toggleId(selectedBrandIds, idStr),
                                                            )
                                                        }
                                                    >
                                                        <Check
                                                            className={cn(
                                                                "mr-2 h-4 w-4",
                                                                selected ? "opacity-100" : "opacity-0",
                                                            )}
                                                        />
                                                        <span className="truncate">{label}</span>
                                                    </CommandItem>
                                                );
                                            })}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </div>

                    <div className="min-w-[160px] flex-1">
                        <Popover open={catOpen} onOpenChange={setCatOpen}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    className="w-full justify-between whitespace-nowrap shadow-none"
                                    type="button"
                                >
                                    <span className="truncate">
                                        {labelCount("Categories", selectedCategoryIds.length, "All categories")}
                                    </span>
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-60" />
                                </Button>
                            </PopoverTrigger>

                            <PopoverContent className="w-[340px] p-0" align="start">
                                <Command shouldFilter={false}>
                                    <div className="flex items-center gap-2 px-2 pt-2">
                                        <CommandInput
                                            placeholder="Search category…"
                                            value={catQuery}
                                            onValueChange={setCatQuery}
                                        />
                                        {selectedCategoryIds.length > 0 ? (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8"
                                                onClick={() => setIds(setFilters, "category_ids", [])}
                                                title="Clear categories"
                                                type="button"
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        ) : null}
                                    </div>

                                    <CommandList>
                                        <CommandEmpty>No categories found.</CommandEmpty>
                                        <CommandGroup heading="Categories">
                                            {filteredCategories.slice(0, 140).map((c) => {
                                                const idStr = safeStr(c.category_id);
                                                const label = safeStr(c.category_name) || "—";
                                                const selected = selectedCategoryIds.includes(idStr);

                                                return (
                                                    <CommandItem
                                                        key={idStr}
                                                        value={`${label} ${idStr}`}
                                                        onSelect={() =>
                                                            setIds(
                                                                setFilters,
                                                                "category_ids",
                                                                toggleId(selectedCategoryIds, idStr),
                                                            )
                                                        }
                                                    >
                                                        <Check
                                                            className={cn(
                                                                "mr-2 h-4 w-4",
                                                                selected ? "opacity-100" : "opacity-0",
                                                            )}
                                                        />
                                                        <span className="truncate">{label}</span>
                                                    </CommandItem>
                                                );
                                            })}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </div>

                    <div className="min-w-[120px] flex-1">
                        <Popover open={unitOpen} onOpenChange={setUnitOpen}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    className="w-full justify-between whitespace-nowrap shadow-none"
                                    type="button"
                                >
                                    <span className="truncate">
                                        {labelCount("UOM", selectedUnitIds.length, "All units")}
                                    </span>
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-60" />
                                </Button>
                            </PopoverTrigger>

                            <PopoverContent className="w-[340px] p-0" align="start">
                                <Command shouldFilter={false}>
                                    <div className="flex items-center gap-2 px-2 pt-2">
                                        <CommandInput
                                            placeholder="Search unit…"
                                            value={unitQuery}
                                            onValueChange={setUnitQuery}
                                        />
                                        {selectedUnitIds.length > 0 ? (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8"
                                                onClick={() => setIds(setFilters, "unit_ids", [])}
                                                title="Clear units"
                                                type="button"
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        ) : null}
                                    </div>

                                    <CommandList>
                                        <CommandEmpty>No units found.</CommandEmpty>
                                        <CommandGroup heading="Units">
                                            {filteredUnits.slice(0, 160).map((u) => {
                                                const idStr = safeStr(u.unit_id);
                                                const label = unitText(u);
                                                const selected = selectedUnitIds.includes(idStr);

                                                return (
                                                    <CommandItem
                                                        key={idStr}
                                                        value={`${label} ${idStr}`}
                                                        onSelect={() =>
                                                            setIds(
                                                                setFilters,
                                                                "unit_ids",
                                                                toggleId(selectedUnitIds, idStr),
                                                            )
                                                        }
                                                    >
                                                        <Check
                                                            className={cn(
                                                                "mr-2 h-4 w-4",
                                                                selected ? "opacity-100" : "opacity-0",
                                                            )}
                                                        />
                                                        <span className="truncate">{label}</span>
                                                    </CommandItem>
                                                );
                                            })}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>
            </div>

            {/* Bottom Row: Secondary Filters & Toggles */}
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-muted bg-muted/20 px-4 py-2.5">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                    <div className="w-[180px]">
                        <Popover open={ptOpen} onOpenChange={setPtOpen}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    className="w-full justify-between whitespace-nowrap bg-background shadow-none"
                                    type="button"
                                >
                                    <span className="truncate">
                                        {labelCount("Prices", selectedPriceTypeIds.length + (filters.show_list_price ? 1 : 0), "All Prices")}
                                    </span>
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-60" />
                                </Button>
                            </PopoverTrigger>

                            <PopoverContent className="w-[200px] p-0" align="start">
                                <Command shouldFilter={true}>
                                    <CommandInput
                                        placeholder="Filter price type…"
                                        value={ptQuery}
                                        onValueChange={setPtQuery}
                                    />
                                    <CommandList>
                                        <CommandEmpty>No price types found.</CommandEmpty>
                                        <CommandGroup heading="Price Types">
                                            <CommandItem
                                                key="list_price"
                                                value="List Price"
                                                onSelect={() =>
                                                    setFilters((prev) => ({
                                                        ...prev,
                                                        show_list_price: !prev.show_list_price,
                                                    }))
                                                }
                                            >
                                                <Check
                                                    className={cn(
                                                        "mr-2 h-4 w-4",
                                                        filters.show_list_price ? "opacity-100" : "opacity-0",
                                                    )}
                                                />
                                                <span className="truncate">List Price</span>
                                            </CommandItem>
                                            {priceTypes.map((pt) => {
                                                const idStr = safeStr(pt.price_type_id);
                                                const label = safeStr(pt.price_type_name) || "—";
                                                const selected = selectedPriceTypeIds.includes(idStr);

                                                return (
                                                    <CommandItem
                                                        key={idStr}
                                                        value={`${label} ${idStr}`}
                                                        onSelect={() =>
                                                            setIds(
                                                                setFilters,
                                                                "price_type_ids",
                                                                toggleId(selectedPriceTypeIds, idStr),
                                                            )
                                                        }
                                                    >
                                                        <Check
                                                            className={cn(
                                                                "mr-2 h-4 w-4",
                                                                selected ? "opacity-100" : "opacity-0",
                                                            )}
                                                        />
                                                        <span className="truncate">Price {label}</span>
                                                    </CommandItem>
                                                );
                                            })}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </div>

                    <div className="hidden h-5 w-px bg-border sm:block" />

                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                            <Switch
                                id="filter-active-only"
                                checked={filters.active_only}
                                onCheckedChange={(checked) =>
                                    setFilters((prev) => ({ ...prev, active_only: checked }))
                                }
                            />
                            <Label htmlFor="filter-active-only" className="cursor-pointer text-sm font-medium">
                                Active only
                            </Label>
                        </div>
                        <div className="flex items-center gap-2">
                            <Switch
                                id="filter-missing-tier"
                                checked={filters.missing_tier}
                                onCheckedChange={(checked) =>
                                    setFilters((prev) => ({ ...prev, missing_tier: checked }))
                                }
                            />
                            <Label htmlFor="filter-missing-tier" className="cursor-pointer text-sm font-medium">
                                Missing tier
                            </Label>
                        </div>
                    </div>
                </div>

                <Button
                    variant="ghost"
                    className="h-8 shrink-0 text-muted-foreground hover:text-foreground"
                    onClick={() => {
                        resetFilters();
                        setSupplierQuery("");
                        setBrandQuery("");
                        setCatQuery("");
                        setUnitQuery("");
                        setPtQuery("");
                    }}
                    type="button"
                >
                    Reset Filters
                </Button>
            </div>

            {/* Chips */}
            {chips.length > 0 ? (
                <div className="border-t pt-3">
                    <div className="flex flex-wrap items-center gap-2">
                        {chips.map((chip) => (
                            <Badge
                                key={chip.key}
                                variant="secondary"
                                className="flex items-center gap-1 rounded-full px-3 py-1 text-xs"
                            >
                                <span className="max-w-[520px] truncate">{chip.label}</span>
                                <button
                                    type="button"
                                    onClick={chip.onRemove}
                                    className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full hover:bg-muted"
                                    aria-label="Remove filter"
                                    title="Remove"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </Badge>
                        ))}
                    </div>
                </div>
            ) : null}
        </Card>
    );
}