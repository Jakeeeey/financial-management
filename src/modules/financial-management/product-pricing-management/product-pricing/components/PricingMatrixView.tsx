// src/modules/supply-chain-management/product-pricing-management/product-pricing/components/PricingMatrixView.tsx
"use client";

import * as React from "react";
import { toast } from "sonner";

import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

import { useLookups } from "../hooks/useLookups";
import { usePriceTypes } from "../hooks/usePriceTypes";
import { usePricingMatrix } from "../hooks/usePricingMatrix";

import PricingFiltersBar from "./PricingFiltersBar";
import PricingTable from "./PricingTable";
import BulkSaveBar from "./BulkSaveBar";

import { pivotPrices } from "../utils/pivot";
import * as api from "../providers/pricingApi";
import PrintPricingDialog from "./PrintPricingDialog";

import type {
    Brand,
    Category,
    MatrixRow,
    PriceRow,
    PricingFilters,
    ProductRow,
    Supplier,
    Unit,
    VariantCell,
} from "../types";

type SupplierScope = "ALL" | "LINKED_ONLY";

type PrintProductsParams = {
    q?: string;
    category_ids?: string;
    brand_ids?: string;
    unit_ids?: string;
    supplier_ids?: string;
    supplier_scope: SupplierScope;
    active_only: "0" | "1";
    missing_tier: "0" | "1";
};

const EMPTY_FILTERS: PricingFilters = {
    q: "",
    category_ids: [],
    brand_ids: [],
    unit_ids: [],
    supplier_ids: [],
    supplier_scope: "ALL",
    active_only: true,
    missing_tier: false,
    price_type_ids: [],
    show_list_price: false,
};

function safeStr(v: unknown): string {
    const s = String(v ?? "").trim();
    if (!s || s === "undefined" || s === "null") return "";
    return s;
}

function toBool01(v: boolean, default01: "0" | "1"): "0" | "1" {
    if (typeof v !== "boolean") return default01;
    return v ? "1" : "0";
}

function toMap<T extends Record<string, string | number | null | undefined>>(
    arr: T[],
    idKey: keyof T,
    labelKey: keyof T,
): Map<number, string> {
    const map = new Map<number, string>();

    for (const item of arr) {
        const id = Number(item[idKey]);
        const label = String(item[labelKey] ?? "");

        if (Number.isFinite(id) && label) {
            map.set(id, label);
        }
    }

    return map;
}

function getIds(
    filters: PricingFilters,
    arrayKey: "category_ids" | "brand_ids" | "unit_ids" | "supplier_ids",
): string[] {
    return filters[arrayKey].map((item) => String(item));
}

function labelListFromIds(ids: string[], byId: Map<number, string>): string[] {
    const out: string[] = [];

    for (const raw of ids) {
        const id = Number(raw);
        out.push(Number.isFinite(id) ? byId.get(id) ?? raw : raw);
    }

    return out.filter(Boolean);
}

function buildFiltersText(args: {
    filters: PricingFilters;
    categoriesById: Map<number, string>;
    brandsById: Map<number, string>;
    unitsById: Map<number, string>;
    suppliersById: Map<number, string>;
}): string {
    const { filters, categoriesById, brandsById, unitsById, suppliersById } = args;

    const parts: string[] = [];

    const q = safeStr(filters.q);

    const categoryIds = getIds(filters, "category_ids");
    const brandIds = getIds(filters, "brand_ids");
    const unitIds = getIds(filters, "unit_ids");
    const supplierIds = getIds(filters, "supplier_ids");

    if (q) parts.push(`Search: ${q}`);

    if (categoryIds.length) {
        const names = labelListFromIds(categoryIds, categoriesById);
        parts.push(`Categories: ${names.join(", ")}`);
    }

    if (brandIds.length) {
        const names = labelListFromIds(brandIds, brandsById);
        parts.push(`Brands: ${names.join(", ")}`);
    }

    if (unitIds.length) {
        const names = labelListFromIds(unitIds, unitsById);
        parts.push(`Units: ${names.join(", ")}`);
    }

    if (supplierIds.length) {
        const names = labelListFromIds(supplierIds, suppliersById);
        parts.push(`Suppliers: ${names.join(", ")}`);
    }

    if (supplierIds.length && filters.supplier_scope === "LINKED_ONLY") {
        parts.push("Scope: Linked Only");
    }

    if (filters.active_only) parts.push("Active Only");
    if (filters.missing_tier) parts.push("Missing Tier");

    return parts.join(" • ");
}

function uniqNumSetFromRows(
    rows: MatrixRow[],
    key: "product_category" | "product_brand" | "unit_of_measurement",
): Set<number> {
    const result = new Set<number>();

    for (const row of rows) {
        const value = Number(row.display?.[key]);
        if (!Number.isNaN(value) && value > 0) {
            result.add(value);
        }
    }

    return result;
}

function sameNumberArray(a: number[], b: number[]): boolean {
    if (a.length !== b.length) return false;

    for (let i = 0; i < a.length; i += 1) {
        if (a[i] !== b[i]) return false;
    }

    return true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function toNullableNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === "") return null;
    if (typeof value === "object" && value !== null) {
        const record = value as Record<string, unknown>;
        const val = record.product_id ?? record.id ?? record.value;
        const n = Number(val);
        return Number.isFinite(n) && n > 0 ? n : null;
    }
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : null;
}

function toNumberOrZero(value: unknown): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

function toStringOrEmpty(value: unknown): string {
    return safeStr(value);
}

function normalizePrintRow(value: unknown): ProductRow | null {
    if (!isRecord(value)) return null;

    const productId = toNullableNumber(value.product_id);
    if (productId === null) return null;

    const productName = toStringOrEmpty(value.product_name);
    if (!productName) return null;

    return {
        product_id: productId,
        parent_id: toNullableNumber(value.parent_id),

        product_code: toStringOrEmpty(value.product_code) || null,
        barcode: toStringOrEmpty(value.barcode) || null,
        product_name: productName,
        isActive: toNumberOrZero(value.isActive),

        product_category: toNullableNumber(value.product_category),
        product_brand: toNullableNumber(value.product_brand),
        unit_of_measurement: toNullableNumber(value.unit_of_measurement),

        price_per_unit: toNumberOrZero(value.price_per_unit),
        priceA: toNumberOrZero(value.priceA),
        priceB: toNumberOrZero(value.priceB),
        priceC: toNumberOrZero(value.priceC),
        priceD: toNumberOrZero(value.priceD),
        priceE: toNumberOrZero(value.priceE),
        cost_per_unit: toNullableNumber(value.cost_per_unit),
    };
}

function extractPrintRows(value: unknown): ProductRow[] {
    if (!isRecord(value)) return [];
    const rawData = value.data;
    if (!Array.isArray(rawData)) return [];

    const rows: ProductRow[] = [];

    for (const item of rawData) {
        const normalized = normalizePrintRow(item);
        if (normalized) {
            rows.push(normalized);
        }
    }

    return rows;
}

function buildLookupMaps(args: {
    categories: Category[];
    brands: Brand[];
    units: Unit[];
    suppliers: Supplier[];
}) {
    const categoriesById = toMap(args.categories, "category_id", "category_name");
    const brandsById = toMap(args.brands, "brand_id", "brand_name");

    const unitsById = new Map<number, string>();
    for (const unit of args.units) {
        const id = Number(unit.unit_id);
        const label = String(unit.unit_shortcut ?? unit.unit_name ?? "");
        if (Number.isFinite(id) && label) {
            unitsById.set(id, label);
        }
    }

    const suppliersById = new Map<number, string>();
    for (const supplier of args.suppliers) {
        const id = Number(supplier.id);
        const shortcut = safeStr(supplier.supplier_shortcut);
        const name = safeStr(supplier.supplier_name);
        const label = shortcut ? `${shortcut} — ${name}` : name;

        if (Number.isFinite(id) && label) {
            suppliersById.set(id, label);
        }
    }

    return { categoriesById, brandsById, unitsById, suppliersById };
}

export default function PricingMatrixView() {
    const pt = usePriceTypes();

    const [lookupFilters, setLookupFilters] = React.useState<PricingFilters>(EMPTY_FILTERS);

    const lookups = useLookups(lookupFilters);

    const lookupMaps = React.useMemo(
        () =>
            buildLookupMaps({
                categories: lookups.categories,
                brands: lookups.brands,
                units: lookups.units,
                suppliers: lookups.suppliers,
            }),
        [lookups.categories, lookups.brands, lookups.units, lookups.suppliers],
    );

    const matrix = usePricingMatrix({
        categoriesById: lookupMaps.categoriesById,
        brandsById: lookupMaps.brandsById,
        unitsById: lookupMaps.unitsById,
        unitsList: lookups.units,
        priceTypes: pt.priceTypes,
        updatedBy: null,
    });

    React.useEffect(() => {
        setLookupFilters(matrix.filters);
    }, [matrix.filters]);

    const selectedSupplierIds = React.useMemo(
        () => matrix.filters.supplier_ids.map((id) => String(id)),
        [matrix.filters.supplier_ids],
    );

    const supplierScope: SupplierScope = matrix.filters.supplier_scope;
    const supplierFilterActive =
        selectedSupplierIds.length > 0 && supplierScope === "LINKED_ONLY";

    const currentRows = React.useMemo<MatrixRow[]>(
        () => (Array.isArray(matrix.rows) ? matrix.rows : []),
        [matrix.rows],
    );
    const allowedCategoryIds = React.useMemo(() => {
        if (!supplierFilterActive) return null;
        return uniqNumSetFromRows(currentRows, "product_category");
    }, [supplierFilterActive, currentRows]);

    const allowedBrandIds = React.useMemo(() => {
        if (!supplierFilterActive) return null;
        return uniqNumSetFromRows(currentRows, "product_brand");
    }, [supplierFilterActive, currentRows]);

    const allowedUnitIds = React.useMemo(() => {
        if (!supplierFilterActive) return null;

        const ids = new Set<number>();

        for (const row of currentRows) {
            for (const key of Object.keys(row.variantsByUnitId)) {
                const unitId = Number(key);
                if (!Number.isNaN(unitId) && unitId > 0) {
                    ids.add(unitId);
                }
            }
        }

        if (ids.size === 0) {
            const fallback = uniqNumSetFromRows(currentRows, "unit_of_measurement");
            for (const id of fallback) ids.add(id);
        }

        return ids;
    }, [supplierFilterActive, currentRows]);

    const scopedCategories = React.useMemo(() => {
        if (!supplierFilterActive || !allowedCategoryIds) return lookups.categories;
        return lookups.categories.filter((item) => allowedCategoryIds.has(Number(item.category_id)));
    }, [supplierFilterActive, allowedCategoryIds, lookups.categories]);

    const scopedBrands = React.useMemo(() => {
        if (!supplierFilterActive || !allowedBrandIds) return lookups.brands;
        return lookups.brands.filter((item) => allowedBrandIds.has(Number(item.brand_id)));
    }, [supplierFilterActive, allowedBrandIds, lookups.brands]);

    const scopedUnits = React.useMemo(() => {
        if (!supplierFilterActive || !allowedUnitIds) return lookups.units;
        return lookups.units.filter((item) => allowedUnitIds.has(Number(item.unit_id)));
    }, [supplierFilterActive, allowedUnitIds, lookups.units]);

    const sanitizeKeyRef = React.useRef<string>("");

    React.useEffect(() => {
        if (!supplierFilterActive) {
            sanitizeKeyRef.current = "";
            return;
        }

        if (matrix.loading) return;
        if (!currentRows.length) return;
        if (!allowedCategoryIds || !allowedBrandIds || !allowedUnitIds) return;

        const key = `${selectedSupplierIds.join(",")}|${supplierScope}`;
        if (sanitizeKeyRef.current === key) return;

        const currentCat = matrix.filters.category_ids;
        const currentBrand = matrix.filters.brand_ids;
        const currentUnit = matrix.filters.unit_ids;

        const nextCat = currentCat.filter((id) => allowedCategoryIds.has(Number(id)));
        const nextBrand = currentBrand.filter((id) => allowedBrandIds.has(Number(id)));
        const nextUnit = currentUnit.filter((id) => allowedUnitIds.has(Number(id)));

        const willChange =
            !sameNumberArray(currentCat, nextCat) ||
            !sameNumberArray(currentBrand, nextBrand) ||
            !sameNumberArray(currentUnit, nextUnit);

        sanitizeKeyRef.current = key;

        if (!willChange) return;

        matrix.setFilters((prev: PricingFilters): PricingFilters => ({
            ...prev,
            category_ids: nextCat,
            brand_ids: nextBrand,
            unit_ids: nextUnit,
        }));
    }, [
        supplierFilterActive,
        supplierScope,
        selectedSupplierIds,
        matrix.loading,
        currentRows,
        allowedCategoryIds,
        allowedBrandIds,
        allowedUnitIds,
        matrix.filters.category_ids,
        matrix.filters.brand_ids,
        matrix.filters.unit_ids,
        matrix.setFilters,
        matrix,
    ]);

    const [printOpen, setPrintOpen] = React.useState(false);
    const [printFiltersText, setPrintFiltersText] = React.useState("");
    const [printGeneratedAt, setPrintGeneratedAt] = React.useState("");
    const [isPrinting, setIsPrinting] = React.useState(false);
    const [printMatrixRows, setPrintMatrixRows] = React.useState<MatrixRow[]>([]);
    const [printUsedUnitIds, setPrintUsedUnitIds] = React.useState<Set<number>>(new Set());

    const openPrint = React.useCallback(async () => {
        setIsPrinting(true);
        try {
            const filters = matrix.filters;

            const params: PrintProductsParams = {
                q: safeStr(filters.q) || undefined,
                category_ids: filters.category_ids.length ? filters.category_ids.join(",") : undefined,
                brand_ids: filters.brand_ids.length ? filters.brand_ids.join(",") : undefined,
                unit_ids: filters.unit_ids.length ? filters.unit_ids.join(",") : undefined,
                supplier_ids: filters.supplier_ids.length ? filters.supplier_ids.join(",") : undefined,
                supplier_scope: filters.supplier_scope,
                active_only: toBool01(filters.active_only, "1"),
                missing_tier: toBool01(filters.missing_tier, "0"),
            };

            // 1. Fetch ALL products (no pagination)
            const res = await api.getPrintProducts(params);
            const allProducts = extractPrintRows(res);

            if (allProducts.length === 0) {
                toast.warning("No printable products found for the current filters.");
                return;
            }

            // 2. Fetch ALL prices for these products in chunks (avoid URL length limits)
            const allProductIds = allProducts.map(p => p.product_id);
            const CHUNK_SIZE = 200;
            const priceRows: PriceRow[] = [];

            for (let i = 0; i < allProductIds.length; i += CHUNK_SIZE) {
                const slice = allProductIds.slice(i, i + CHUNK_SIZE);
                const chunkRes = await api.getPricesForProducts(slice);
                if (Array.isArray(chunkRes.data)) {
                    priceRows.push(...chunkRes.data);
                }
            }

            const priceMap = pivotPrices(pt.priceTypes, priceRows);

            // 3. Group into MatrixRows
            const groups = new Map<number, ProductRow[]>();
            const usedUnitIds = new Set<number>();

            for (const p of allProducts) {
                // Harden gid: if parent_id is 0 or null, use product_id
                const gid = (p.parent_id && p.parent_id > 0) ? p.parent_id : p.product_id;

                if (!groups.has(gid)) groups.set(gid, []);
                groups.get(gid)!.push(p);

                if (p.unit_of_measurement) usedUnitIds.add(Number(p.unit_of_measurement));
            }

            const assembled: MatrixRow[] = [];
            const EMPTY_PIVOT = { A: null, B: null, C: null, D: null, E: null, LIST: null };

            for (const [groupId, variants] of groups.entries()) {
                const display = variants.find(v => v.product_id === groupId) || variants[0];
                const variantsByUnitId: Record<number, VariantCell> = {};

                for (const v of variants) {
                    const uomId = Number(v.unit_of_measurement);
                    if (uomId) {
                        variantsByUnitId[uomId] = {
                            product: v,
                            tiers: { ...(priceMap.get(v.product_id) ?? EMPTY_PIVOT) }
                        };
                    }
                }

                assembled.push({
                    group_id: groupId,
                    display,
                    variantsByUnitId,
                    category_name: display.product_category ? lookupMaps.categoriesById.get(Number(display.product_category)) ?? null : null,
                    brand_name: display.product_brand ? lookupMaps.brandsById.get(Number(display.product_brand)) ?? null : null,
                });
            }

            assembled.sort((a, b) =>
                (a.display.product_name || "").localeCompare(b.display.product_name || "")
            );

            const resolvedFiltersText = buildFiltersText({
                filters,
                categoriesById: lookupMaps.categoriesById,
                brandsById: lookupMaps.brandsById,
                unitsById: lookupMaps.unitsById,
                suppliersById: lookupMaps.suppliersById,
            });

            const now = new Date();

            setPrintGeneratedAt(`${now.toLocaleDateString()} ${now.toLocaleTimeString()}`);
            setPrintFiltersText(resolvedFiltersText);
            setPrintMatrixRows(assembled);
            setPrintUsedUnitIds(usedUnitIds);
            setPrintOpen(true);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "Failed to open print editor";
            toast.error(message);
        } finally {
            setIsPrinting(false);
        }
    }, [matrix.filters, lookupMaps, pt.priceTypes]);

    React.useEffect(() => {
        if (lookups.error) toast.error(lookups.error);
        if (pt.error) toast.error(pt.error);
    }, [lookups.error, pt.error]);

    const isInitialLoad = (lookups.loading || pt.loading) && currentRows.length === 0;

    if (isInitialLoad) {
        return (
            <div className="space-y-3">
                <Skeleton className="h-10 w-full rounded-xl" />
                <Skeleton className="h-64 w-full rounded-xl" />
            </div>
        );
    }

    return (
        <div className="h-[calc(100dvh-64px)] min-h-0 overflow-hidden px-0">
            <div className="flex h-full min-h-0 flex-col gap-3">
                <div className="shrink-0">
                    <PricingFiltersBar
                        filters={matrix.filters}
                        setFilters={matrix.setFilters}
                        resetFilters={matrix.resetFilters}
                        categories={scopedCategories}
                        brands={scopedBrands}
                        units={scopedUnits}
                        suppliers={lookups.suppliers}
                        priceTypes={pt.priceTypes}
                    />
                </div>

                <div className="shrink-0">
                    <Separator />
                </div>

                <div className="shrink-0">
                    <BulkSaveBar
                        dirtyCount={matrix.dirtyCount}
                        onSave={matrix.saveAll}
                        onDiscard={matrix.discardAll}
                        onRefresh={matrix.refresh}
                        onPrint={openPrint}
                        loading={Boolean(matrix.loading) || isPrinting}
                    />
                </div>

                <div className="min-h-0 flex-1 overflow-hidden">
                    <PricingTable matrix={matrix} />
                </div>

                <PrintPricingDialog
                    open={printOpen}
                    onOpenChange={setPrintOpen}
                    rows={printMatrixRows}
                    filtersText={printFiltersText}
                    generatedAtText={printGeneratedAt}
                    unitName={(id) => (id ? lookupMaps.unitsById.get(Number(id)) ?? "" : "")}
                    units={lookups.units}
                    priceTypes={pt.priceTypes}
                    usedUnitIds={printUsedUnitIds}
                />
            </div>
        </div>
    );
}