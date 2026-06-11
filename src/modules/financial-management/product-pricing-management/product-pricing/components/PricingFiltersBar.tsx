// src/modules/supply-chain-management/product-pricing-management/product-pricing/components/PricingFiltersBar.tsx
"use client";

import * as React from "react";
import type { Brand, Category, PriceType, PricingFilters, Supplier, Unit } from "../types";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    InputGroup,
    InputGroupAddon,
    InputGroupButton,
    InputGroupInput,
} from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { Check, ChevronDown, ChevronsUpDown, Filter, RotateCcw, Search, X } from "lucide-react";

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

type MultiSelectOption = {
    id: string;
    label: string;
    search?: string;
};

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
    return shortcut ? `${shortcut} - ${name}` : name;
}

function unitText(u: Unit): string {
    const shortcut = safeStr(u.unit_shortcut);
    const name = safeStr(u.unit_name);
    return shortcut || name || "-";
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

function priceTypeText(pt: PriceType): string {
    const label = safeStr(pt.price_type_name);
    return label ? `Price ${label}` : `Price #${pt.price_type_id}`;
}

function sortPriceTypes(priceTypes: PriceType[]): PriceType[] {
    return [...priceTypes].sort((a, b) => {
        const aSort = Number(a.sort ?? Number.MAX_SAFE_INTEGER);
        const bSort = Number(b.sort ?? Number.MAX_SAFE_INTEGER);
        return aSort - bSort || safeStr(a.price_type_name).localeCompare(safeStr(b.price_type_name));
    });
}

function FilterField(props: {
    label: string;
    helper?: string;
    children: React.ReactNode;
    className?: string;
}) {
    const { label, helper, children, className } = props;

    return (
        <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
            <Label className="text-xs font-medium text-foreground">{label}</Label>
            {children}
            {helper ? <p className="text-[11px] leading-snug text-muted-foreground">{helper}</p> : null}
        </div>
    );
}

function MultiSelectFilter(props: {
    label: string;
    helper?: string;
    triggerLabel: string;
    searchPlaceholder: string;
    emptyText: string;
    groupLabel: string;
    options: MultiSelectOption[];
    selectedIds: string[];
    onChange: (ids: string[]) => void;
    clearTitle: string;
    footer?: React.ReactNode;
    limit?: number;
    contentMaxWidth?: string;
    className?: string;
}) {
    const {
        label,
        helper,
        triggerLabel,
        searchPlaceholder,
        emptyText,
        groupLabel,
        options,
        selectedIds,
        onChange,
        clearTitle,
        footer,
        limit = 140,
        contentMaxWidth = "max-w-[360px]",
        className,
    } = props;

    const [open, setOpen] = React.useState(false);
    const [query, setQuery] = React.useState("");

    const filteredOptions = React.useMemo(() => {
        const q = query.trim().toLowerCase();
        const source = q
            ? options.filter((option) => {
                const search = `${option.label} ${option.id} ${option.search ?? ""}`.toLowerCase();
                return search.includes(q);
            })
            : options;

        return source.slice(0, limit);
    }, [limit, options, query]);

    return (
        <FilterField label={label} helper={helper} className={className}>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        className="h-10 w-full justify-between gap-2 bg-background px-3 shadow-none"
                        type="button"
                    >
                        <span className="truncate">{triggerLabel}</span>
                        <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-60" />
                    </Button>
                </PopoverTrigger>

                <PopoverContent
                    className={cn("w-[calc(100vw-2rem)] p-0", contentMaxWidth)}
                    align="start"
                >
                    <Command shouldFilter={false}>
                        <div className="flex items-center gap-2 px-2 pt-2">
                            <CommandInput
                                placeholder={searchPlaceholder}
                                value={query}
                                onValueChange={setQuery}
                            />
                            {selectedIds.length > 0 ? (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => onChange([])}
                                    title={clearTitle}
                                    type="button"
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            ) : null}
                        </div>

                        <CommandList>
                            <CommandEmpty>{emptyText}</CommandEmpty>
                            <CommandGroup heading={groupLabel}>
                                {filteredOptions.map((option) => {
                                    const selected = selectedIds.includes(option.id);

                                    return (
                                        <CommandItem
                                            key={option.id}
                                            value={`${option.label} ${option.id}`}
                                            onSelect={() => onChange(toggleId(selectedIds, option.id))}
                                        >
                                            <Check
                                                className={cn(
                                                    "mr-2 h-4 w-4",
                                                    selected ? "opacity-100" : "opacity-0",
                                                )}
                                            />
                                            <span className="truncate">{option.label}</span>
                                        </CommandItem>
                                    );
                                })}
                            </CommandGroup>
                        </CommandList>
                    </Command>

                    {footer ? <div className="border-t px-3 py-2 text-xs text-muted-foreground">{footer}</div> : null}
                </PopoverContent>
            </Popover>
        </FilterField>
    );
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
    const [advancedOpen, setAdvancedOpen] = React.useState(false);

    React.useEffect(() => {
        setLocalQ(filters.q);
    }, [filters.q]);

    const supplierOptions = React.useMemo<MultiSelectOption[]>(
        () => {
            const options: MultiSelectOption[] = [];

            for (const supplier of suppliers) {
                const id = safeStr(supplier.id);
                if (!id) continue;

                options.push({
                    id,
                    label: supplierText(supplier),
                    search: safeStr(supplier.supplier_shortcut),
                });
            }

            return options;
        },
        [suppliers],
    );

    const brandOptions = React.useMemo<MultiSelectOption[]>(
        () => {
            const options: MultiSelectOption[] = [];

            for (const brand of brands) {
                const id = safeStr(brand.brand_id);
                if (!id) continue;

                options.push({ id, label: safeStr(brand.brand_name) || "-" });
            }

            return options;
        },
        [brands],
    );

    const categoryOptions = React.useMemo<MultiSelectOption[]>(
        () => {
            const options: MultiSelectOption[] = [];

            for (const category of categories) {
                const id = safeStr(category.category_id);
                if (!id) continue;

                options.push({ id, label: safeStr(category.category_name) || "-" });
            }

            return options;
        },
        [categories],
    );

    const unitOptions = React.useMemo<MultiSelectOption[]>(
        () => {
            const options: MultiSelectOption[] = [];

            for (const unit of units) {
                const id = safeStr(unit.unit_id);
                if (!id) continue;

                options.push({
                    id,
                    label: unitText(unit),
                    search: safeStr(unit.unit_name),
                });
            }

            return options;
        },
        [units],
    );

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
            const label = safeStr(b.brand_name) || "-";
            if (id) map.set(id, label);
        }
        return map;
    }, [brands]);

    const categoryLabelById = React.useMemo(() => {
        const map = new Map<string, string>();
        for (const c of categories) {
            const id = safeStr(c.category_id);
            const label = safeStr(c.category_name) || "-";
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
            const label = safeStr(pt.price_type_name) || "-";
            if (id) map.set(id, label);
        }
        return map;
    }, [priceTypes]);

    const sortedPriceTypes = React.useMemo(() => sortPriceTypes(priceTypes), [priceTypes]);
    const defaultPriceType = sortedPriceTypes[0] ?? null;
    const focusedPriceTypeId = selectedPriceTypeIds[0] || (defaultPriceType ? safeStr(defaultPriceType.price_type_id) : "");
    const priceViewValue =
        filters.price_view === "ALL"
            ? "ALL"
            : filters.price_view === "LIST"
                ? "LIST"
                : focusedPriceTypeId
                    ? `PRICE:${focusedPriceTypeId}`
                    : "LIST";

    const advancedCount = selectedBrandIds.length + selectedCategoryIds.length + selectedUnitIds.length;

    React.useEffect(() => {
        if (advancedCount > 0) setAdvancedOpen(true);
    }, [advancedCount]);

    const setPriceView = React.useCallback(
        (value: string) => {
            if (value === "ALL") {
                setFilters((prev) => ({
                    ...prev,
                    price_view: "ALL",
                    price_type_ids: [],
                    show_list_price: false,
                }));
                return;
            }

            if (value === "LIST") {
                setFilters((prev) => ({
                    ...prev,
                    price_view: "LIST",
                    price_type_ids: [],
                    show_list_price: false,
                }));
                return;
            }

            const priceTypeId = Number(value.replace("PRICE:", ""));
            if (!Number.isFinite(priceTypeId) || priceTypeId <= 0) return;

            setFilters((prev) => ({
                ...prev,
                price_view: "FOCUSED",
                price_type_ids: [priceTypeId],
                show_list_price: false,
            }));
        },
        [setFilters],
    );

    const applySearch = React.useCallback(() => {
        setFilters((prev) => ({ ...prev, q: localQ.trim() }));
    }, [localQ, setFilters]);

    const clearSearch = React.useCallback(() => {
        setLocalQ("");
        setFilters((prev) => ({ ...prev, q: "" }));
    }, [setFilters]);

    const resetAllFilters = React.useCallback(() => {
        resetFilters();
        setLocalQ("");
        setAdvancedOpen(false);
    }, [resetFilters]);

    const chips: Array<{ key: string; label: string; onRemove: () => void }> = [];

    const q = safeStr(filters.q);
    if (q) {
        chips.push({
            key: `q:${q}`,
            label: `Search: ${q}`,
            onRemove: clearSearch,
        });
    }

    for (const id of selectedSupplierIds) {
        const label = supplierLabelById.get(id) ?? `Supplier #${id}`;
        chips.push({
            key: `s:${id}`,
            label: `Supplier: ${label}`,
            onRemove: () =>
                setIds(setFilters, "supplier_ids", selectedSupplierIds.filter((x) => x !== id)),
        });
    }

    for (const id of selectedBrandIds) {
        const label = brandLabelById.get(id) ?? `Brand #${id}`;
        chips.push({
            key: `b:${id}`,
            label: `Brand: ${label}`,
            onRemove: () =>
                setIds(setFilters, "brand_ids", selectedBrandIds.filter((x) => x !== id)),
        });
    }

    for (const id of selectedCategoryIds) {
        const label = categoryLabelById.get(id) ?? `Category #${id}`;
        chips.push({
            key: `c:${id}`,
            label: `Category: ${label}`,
            onRemove: () =>
                setIds(setFilters, "category_ids", selectedCategoryIds.filter((x) => x !== id)),
        });
    }

    for (const id of selectedUnitIds) {
        const label = unitLabelById.get(id) ?? `UOM #${id}`;
        chips.push({
            key: `u:${id}`,
            label: `UOM: ${label}`,
            onRemove: () =>
                setIds(setFilters, "unit_ids", selectedUnitIds.filter((x) => x !== id)),
        });
    }

    if (filters.price_view === "ALL") {
        chips.push({
            key: "price_view_all",
            label: "Price view: All prices",
            onRemove: () =>
                setFilters((prev) => ({
                    ...prev,
                    price_view: "FOCUSED",
                    price_type_ids: [],
                    show_list_price: false,
                })),
        });
    } else if (filters.price_view === "LIST") {
        chips.push({
            key: "price_view_list",
            label: "Price view: List Cost",
            onRemove: () =>
                setFilters((prev) => ({
                    ...prev,
                    price_view: "FOCUSED",
                    price_type_ids: [],
                    show_list_price: false,
                })),
        });
    } else if (selectedPriceTypeIds.length > 0) {
        const id = selectedPriceTypeIds[0];
        const label = priceTypeLabelById.get(id) ?? `#${id}`;
        chips.push({
            key: `price_view:${id}`,
            label: `Price view: Price ${label}`,
            onRemove: () =>
                setFilters((prev) => ({
                    ...prev,
                    price_view: "FOCUSED",
                    price_type_ids: [],
                    show_list_price: false,
                })),
        });
    }

    if (!filters.active_only) {
        chips.push({
            key: "active_only",
            label: "Status: Includes inactive",
            onRemove: () => setFilters((prev) => ({ ...prev, active_only: true })),
        });
    }

    if (filters.missing_tier) {
        chips.push({
            key: "missing_tier",
            label: "Missing price tiers",
            onRemove: () => setFilters((prev) => ({ ...prev, missing_tier: false })),
        });
    }

    const hasNonDefaultFilters =
        chips.length > 0 ||
        filters.price_view !== "FOCUSED" ||
        selectedPriceTypeIds.length > 0 ||
        Boolean(filters.show_list_price);

    return (
        <Card className="overflow-hidden rounded-2xl shadow-sm">
            <div className="flex flex-col gap-4 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                        <h2 className="text-sm font-semibold text-foreground">Product pricing filters</h2>
                        <p className="text-xs text-muted-foreground">
                            Search products and narrow the price matrix by supplier, price view, and catalog details.
                        </p>
                    </div>

                    {hasNonDefaultFilters ? (
                        <Button
                            variant="ghost"
                            className="h-8 w-fit shrink-0 gap-2 text-muted-foreground hover:text-foreground"
                            onClick={resetAllFilters}
                            type="button"
                        >
                            <RotateCcw className="h-4 w-4" />
                            Reset filters
                        </Button>
                    ) : null}
                </div>

                <div className="grid gap-3 xl:grid-cols-[minmax(280px,1.25fr)_minmax(220px,1fr)_minmax(200px,0.85fr)_minmax(260px,0.9fr)]">
                    <FilterField label="Search products" helper="Name, product code, or barcode.">
                        <InputGroup className="h-10 bg-background">
                            <InputGroupAddon align="inline-start">
                                <Search className="h-4 w-4" />
                            </InputGroupAddon>
                            <InputGroupInput
                                placeholder="Name, code, or barcode"
                                value={localQ}
                                onChange={(e) => setLocalQ(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault();
                                        applySearch();
                                    }
                                }}
                            />
                            <InputGroupAddon align="inline-end" className="gap-1">
                                {localQ ? (
                                    <InputGroupButton
                                        size="icon-xs"
                                        variant="ghost"
                                        onClick={clearSearch}
                                        title="Clear search"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </InputGroupButton>
                                ) : null}
                                <InputGroupButton
                                    size="sm"
                                    variant="secondary"
                                    onClick={applySearch}
                                    title="Search products"
                                >
                                    Search
                                </InputGroupButton>
                            </InputGroupAddon>
                        </InputGroup>
                    </FilterField>

                    <MultiSelectFilter
                        label="Supplier"
                        helper={selectedSupplierIds.length > 0 ? "Showing linked supplier products." : "All suppliers included."}
                        triggerLabel={
                            `${labelCount("Suppliers", selectedSupplierIds.length, "All suppliers")}${selectedSupplierIds.length ? " - Linked" : ""}`
                        }
                        searchPlaceholder="Search supplier"
                        emptyText="No suppliers found."
                        groupLabel="Suppliers"
                        options={supplierOptions}
                        selectedIds={selectedSupplierIds}
                        onChange={(ids) => setIds(setFilters, "supplier_ids", ids)}
                        clearTitle="Clear suppliers"
                        footer="Selecting a supplier limits the matrix to products linked to that supplier."
                        contentMaxWidth="max-w-[380px]"
                    />

                    <FilterField label="Price view" helper="Choose the price columns shown in the matrix.">
                        <Select value={priceViewValue} onValueChange={setPriceView}>
                            <SelectTrigger className="h-10 w-full bg-background shadow-none">
                                <SelectValue placeholder="Select price view" />
                            </SelectTrigger>
                            <SelectContent>
                                {sortedPriceTypes.map((pt) => (
                                    <SelectItem key={pt.price_type_id} value={`PRICE:${pt.price_type_id}`}>
                                        {priceTypeText(pt)}
                                    </SelectItem>
                                ))}
                                <SelectItem value="LIST">List Cost</SelectItem>
                                <SelectItem value="ALL">All Prices</SelectItem>
                            </SelectContent>
                        </Select>
                    </FilterField>

                    <FilterField label="Product status" helper="Limit results by product or price condition.">
                        <div className="flex min-h-10 flex-col gap-2 rounded-md border bg-background px-3 py-2 sm:flex-row sm:items-center sm:gap-4">
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
                    </FilterField>
                </div>

                <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
                    <div className="flex flex-col gap-2 rounded-xl border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <CollapsibleTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        className="h-8 gap-2 px-2 text-sm font-medium"
                                        type="button"
                                    >
                                        <Filter className="h-4 w-4" />
                                        Advanced filters
                                        {advancedCount > 0 ? (
                                            <Badge variant="secondary" className="rounded-full px-2 py-0 text-[11px]">
                                                {advancedCount}
                                            </Badge>
                                        ) : null}
                                        <ChevronDown
                                            className={cn(
                                                "h-4 w-4 transition-transform",
                                                advancedOpen && "rotate-180",
                                            )}
                                        />
                                    </Button>
                                </CollapsibleTrigger>
                            </div>
                            <p className="px-2 text-xs text-muted-foreground">
                                Brand, category, and unit of measure filters.
                            </p>
                        </div>
                    </div>

                    <CollapsibleContent>
                        <div className="grid gap-3 px-1 pt-3 md:grid-cols-3">
                            <MultiSelectFilter
                                label="Brand"
                                triggerLabel={labelCount("Brands", selectedBrandIds.length, "All brands")}
                                searchPlaceholder="Search brand"
                                emptyText="No brands found."
                                groupLabel="Brands"
                                options={brandOptions}
                                selectedIds={selectedBrandIds}
                                onChange={(ids) => setIds(setFilters, "brand_ids", ids)}
                                clearTitle="Clear brands"
                            />

                            <MultiSelectFilter
                                label="Category"
                                triggerLabel={labelCount("Categories", selectedCategoryIds.length, "All categories")}
                                searchPlaceholder="Search category"
                                emptyText="No categories found."
                                groupLabel="Categories"
                                options={categoryOptions}
                                selectedIds={selectedCategoryIds}
                                onChange={(ids) => setIds(setFilters, "category_ids", ids)}
                                clearTitle="Clear categories"
                            />

                            <MultiSelectFilter
                                label="Unit of measure"
                                triggerLabel={labelCount("UOM", selectedUnitIds.length, "All units")}
                                searchPlaceholder="Search unit"
                                emptyText="No units found."
                                groupLabel="Units"
                                options={unitOptions}
                                selectedIds={selectedUnitIds}
                                onChange={(ids) => setIds(setFilters, "unit_ids", ids)}
                                clearTitle="Clear units"
                            />
                        </div>
                    </CollapsibleContent>
                </Collapsible>
            </div>

            {chips.length > 0 ? (
                <div className="border-t bg-muted/10 px-4 py-3">
                    <div className="flex flex-col gap-2">
                        <div className="text-xs font-medium text-muted-foreground">Active filters</div>
                        <div className="flex flex-wrap items-center gap-2">
                            {chips.map((chip) => (
                                <Badge
                                    key={chip.key}
                                    variant="secondary"
                                    className="flex max-w-full items-center gap-1 rounded-full px-3 py-1 text-xs"
                                >
                                    <span className="max-w-[520px] truncate">{chip.label}</span>
                                    <button
                                        type="button"
                                        onClick={chip.onRemove}
                                        className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full hover:bg-muted"
                                        aria-label={`Remove ${chip.label}`}
                                        title="Remove"
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                </Badge>
                            ))}
                        </div>
                    </div>
                </div>
            ) : null}
        </Card>
    );
}
