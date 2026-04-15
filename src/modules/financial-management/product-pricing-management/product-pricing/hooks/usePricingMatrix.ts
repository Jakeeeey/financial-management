"use client";

import { useMemo, useCallback, useState, useEffect } from "react";
import { toast } from "sonner";

import type {
    MatrixRow,
    PricingFilters,
    ProductTierKey,
    Unit,
    ProductRow,
    VariantCell,
    PriceType,
} from "../types";
import * as api from "../providers/pricingApi";
import { TIERS } from "../utils/constants";
import { clampMoney, toNumberOrNull } from "../utils/format";
import { pivotPrices, buildTierIdMap } from "../utils/pivot";
import { validatePrice } from "../utils/validators";

type DirtyKey = `${number}:${ProductTierKey}`;



type ProductsMeta = {
    total?: number;
    page?: number;
    page_size?: number;
    pageCount?: number;
    [key: string]: string | number | boolean | null | undefined;
} | undefined;

type MatrixProductRow = ProductRow & {
    __group_id?: number | null;
};

const EMPTY_PIVOT: Record<ProductTierKey, number | null> = {
    A: null,
    B: null,
    C: null,
    D: null,
    E: null,
    LIST: null,
};

const defaultFilters: PricingFilters = {
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

export function usePricingMatrix(args: {
    categoriesById: Map<number, string>;
    brandsById: Map<number, string>;
    unitsById: Map<number, string>;
    unitsList?: Unit[];
    priceTypes: PriceType[];
    updatedBy?: number | null;
}) {
    const { categoriesById, brandsById, unitsById, unitsList = [], priceTypes } = args;

    const tierIdMap = useMemo(() => buildTierIdMap(priceTypes), [priceTypes]);

    const [filters, setFilters] = useState<PricingFilters>(defaultFilters);

    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);

    const [loading, setLoading] = useState(false);
    const [rows, setRows] = useState<MatrixRow[]>([]);
    const [meta, setMeta] = useState<ProductsMeta>(undefined);
    const [usedUnits, setUsedUnits] = useState<Unit[]>([]);

    const [dirty, setDirty] = useState<Map<DirtyKey, string>>(new Map());
    const [dirtyErrors, setDirtyErrors] = useState<Map<DirtyKey, string>>(new Map());

    const filtersKey = useMemo(
        () =>
            JSON.stringify({
                q: filters.q,
                supplier_scope: filters.supplier_scope,
                active_only: filters.active_only,
                missing_tier: filters.missing_tier,
                category_ids: filters.category_ids ?? [],
                brand_ids: filters.brand_ids ?? [],
                unit_ids: filters.unit_ids ?? [],
                supplier_ids: filters.supplier_ids ?? [],
                price_type_ids: filters.price_type_ids ?? [],
                show_list_price: filters.show_list_price,
            }),
        [
            filters.q,
            filters.supplier_scope,
            filters.active_only,
            filters.missing_tier,
            filters.category_ids,
            filters.brand_ids,
            filters.unit_ids,
            filters.supplier_ids,
            filters.price_type_ids,
            filters.show_list_price,
        ],
    );

    useEffect(() => {
        setPage(1);
    }, [filtersKey]);

    const refresh = useCallback(async () => {
        setLoading(true);

        try {
            const res = await api.getProducts({
                q: filters.q || undefined,
                category_ids: filters.category_ids.length ? filters.category_ids.join(",") : undefined,
                brand_ids: filters.brand_ids.length ? filters.brand_ids.join(",") : undefined,
                unit_ids: filters.unit_ids.length ? filters.unit_ids.join(",") : undefined,
                supplier_ids: filters.supplier_ids.length ? filters.supplier_ids.join(",") : undefined,
                supplier_scope: filters.supplier_scope,
                active_only: filters.active_only ? "1" : "0",
                missing_tier: filters.missing_tier ? "1" : "0",
                page: String(page),
                page_size: String(pageSize),
            });

            const products: MatrixProductRow[] = (res.data ?? []) as MatrixProductRow[];
            setMeta(res.meta);

            const unitIds = new Set<number>();
            for (const p of products) {
                const uom = toNumberOrNull(p.unit_of_measurement);
                if (uom !== null && Number.isFinite(uom)) {
                    unitIds.add(uom);
                }
            }

            const used = unitsList
                .filter((u) => unitIds.has(Number(u.unit_id)))
                .sort(
                    (a, b) =>
                        Number(a.order ?? 0) - Number(b.order ?? 0) ||
                        unitLabel(a).localeCompare(unitLabel(b)),
                );

            const usedFallback: Unit[] = Array.from(unitIds).map((id) => ({
                unit_id: id,
                unit_name: unitsById.get(id) ?? null,
                unit_shortcut: unitsById.get(id) ?? null,
            }));

            setUsedUnits(used.length ? used : usedFallback);

            const productIds = products
                .map((p) => toNumberOrNull(p.product_id))
                .filter((id): id is number => id !== null);

            const priceRes = await api.getPricesForProducts(productIds);
            const priceMap = pivotPrices(priceTypes, priceRes.data ?? []);

            const groups = new Map<number, MatrixProductRow[]>();
            for (const p of products) {
                const groupId =
                    toNumberOrNull(p.__group_id) ??
                    toNumberOrNull(p.parent_id) ??
                    toNumberOrNull(p.product_id);

                if (groupId === null || !Number.isFinite(groupId) || groupId <= 0) continue;

                const existing = groups.get(groupId);
                if (existing) {
                    existing.push(p);
                } else {
                    groups.set(groupId, [p]);
                }
            }

            const assembled: MatrixRow[] = [];

            for (const [groupId, variants] of groups.entries()) {
                const display =
                    variants.find(
                        (v) =>
                            toNumberOrNull(v.product_id) !== null &&
                            toNumberOrNull(v.product_id) === groupId,
                    ) ??
                    variants.find((v) => v.parent_id == null) ??
                    variants[0];

                const categoryId = toNumberOrNull(display.product_category);
                const brandId = toNumberOrNull(display.product_brand);

                const cat = categoryId !== null ? categoriesById.get(categoryId) ?? null : null;
                const br = brandId !== null ? brandsById.get(brandId) ?? null : null;

                const variantsByUnitId: Record<number, VariantCell> = {};

                for (const v of variants) {
                    const uomId = toNumberOrNull(v.unit_of_measurement);
                    if (uomId === null || uomId <= 0) continue;

                    const productId = toNumberOrNull(v.product_id);
                    const piv = productId !== null ? priceMap.get(productId) ?? EMPTY_PIVOT : EMPTY_PIVOT;

                    variantsByUnitId[uomId] = {
                        product: v,
                        tiers: { ...piv, LIST: toNumberOrNull(v.cost_per_unit) },
                    };
                }

                assembled.push({
                    group_id: groupId,
                    display,
                    variantsByUnitId,
                    category_name: cat,
                    brand_name: br,
                });
            }

            assembled.sort((a, b) =>
                String(a.display.product_name ?? "").localeCompare(String(b.display.product_name ?? "")),
            );

            setRows(assembled);
        } finally {
            setLoading(false);
        }
    }, [filters, page, pageSize, categoriesById, brandsById, unitsById, unitsList, priceTypes]);

    useEffect(() => {
        refresh().catch((error: unknown) => {
            const message = error instanceof Error ? error.message : "Failed to load pricing matrix";
            toast.error(message);
        });
    }, [refresh]);

    const setCell = useCallback((productId: number, tier: ProductTierKey, raw: unknown) => {
        const key: DirtyKey = `${productId}:${tier}`;
        const rawString = String(raw ?? "");
        const value = clampMoney(toNumberOrNull(rawString));
        const err = validatePrice(value);

        setDirty((prev) => {
            const next = new Map(prev);
            next.set(key, rawString);
            return next;
        });

        setDirtyErrors((prev) => {
            const next = new Map(prev);
            if (err) next.set(key, err);
            else next.delete(key);
            return next;
        });
    }, []);

    const getCellValue = useCallback((productId: number, tier: ProductTierKey, base: number | null) => {
        const key: DirtyKey = `${productId}:${tier}`;
        if (dirty.has(key)) return dirty.get(key) ?? "";
        return base;
    }, [dirty]);

    const isDirty = useCallback((productId: number, tier: ProductTierKey) => {
        return dirty.has(`${productId}:${tier}` as DirtyKey);
    }, [dirty]);

    const getError = useCallback((productId: number, tier: ProductTierKey) => {
        return dirtyErrors.get(`${productId}:${tier}` as DirtyKey) ?? null;
    }, [dirtyErrors]);

    const saveAll = useCallback(async () => {
        if (dirtyErrors.size > 0) {
            toast.error("Please fix validation errors before submitting.");
            return;
        }

        if (dirty.size === 0) {
            toast.message("No changes to submit.");
            return;
        }

        const pcrItems: { product_id: number; price_type_id: number; proposed_price: number }[] = [];
        const costPcrItems: { product_id: number; proposed_cost: number; current_cost: number | null }[] = [];

        for (const [k, price] of dirty.entries()) {
            const [pidStr, tier] = k.split(":") as [string, ProductTierKey];
            const productId = Number(pidStr);

            if (tier === "LIST") {
                // Find original cost from rows state
                let current_cost: number | null = null;
                rows_loop: for (const row of rows) {
                    for (const v of Object.values(row.variantsByUnitId)) {
                        const pid = toNumberOrNull(v.product.product_id);
                        if (pid === productId) {
                            current_cost = toNumberOrNull(v.product.cost_per_unit);
                            break rows_loop;
                        }
                    }
                }

                const proposed = Number(price);
                if (Number.isFinite(proposed)) {
                    costPcrItems.push({
                        product_id: productId,
                        proposed_cost: proposed,
                        current_cost,
                    });
                }
                continue;
            }

            const priceTypeId = tierIdMap.get(tier);
            if (!priceTypeId) continue;

            const proposed = Number(price);
            if (!Number.isFinite(proposed)) continue;

            pcrItems.push({
                product_id: productId,
                price_type_id: priceTypeId,
                proposed_price: proposed,
            });
        }

        if (pcrItems.length === 0 && costPcrItems.length === 0) {
            toast.error("No valid changes to submit.");
            return;
        }

        try {
            const promises: Promise<unknown>[] = [];

            if (pcrItems.length > 0) {
                promises.push(api.createPriceChangeRequests(pcrItems));
            }

            if (costPcrItems.length > 0) {
                promises.push(api.createCostChangeRequests(costPcrItems));
            }

            const results = await Promise.all(promises);

            const parts: string[] = [];

            // Result of pcrItems
            if (pcrItems.length > 0) {
                const res = results[0] as {
                    created?: number;
                    skipped_existing_pending?: number;
                    skipped_duplicates?: number;
                };
                parts.push(`Submitted ${res.created ?? 0} tier request(s).`);
                if ((res.skipped_existing_pending ?? 0) > 0) {
                    parts.push(`Skipped (existing pending): ${res.skipped_existing_pending}`);
                }
            }

            // Result of costPcrItems
            if (costPcrItems.length > 0) {
                const res = (pcrItems.length > 0 ? results[1] : results[0]) as {
                    created?: number;
                    skipped_existing_pending?: number;
                };
                parts.push(`Submitted ${res.created ?? 0} List Price request(s).`);
                if ((res.skipped_existing_pending ?? 0) > 0) {
                    parts.push(`Skipped List Price (existing pending): ${res.skipped_existing_pending}`);
                }
            }

            toast.success(parts.join(" "));

            setDirty(new Map());
            setDirtyErrors(new Map());

            await refresh();
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "Failed to save changes";
            toast.error(message);
        }
    }, [dirty, dirtyErrors, tierIdMap, refresh, rows]);

    const discardAll = useCallback(() => {
        setDirty(new Map());
        setDirtyErrors(new Map());
    }, []);

    const resetFilters = useCallback(() => {
        setFilters(defaultFilters);
        setPage(1);
    }, []);

    return useMemo(() => ({
        TIERS,
        loading,
        rows,
        meta,
        usedUnits,
        priceTypes,

        filters,
        setFilters,
        resetFilters,

        page,
        setPage,
        pageSize,
        setPageSize,

        setCell,
        getCellValue,
        isDirty,
        getError,

        dirtyCount: dirty.size,
        saveAll,
        discardAll,

        refresh,
    }), [
        loading,
        rows,
        meta,
        usedUnits,
        priceTypes,
        filters,
        setFilters,
        resetFilters,
        page,
        setPage,
        pageSize,
        setPageSize,
        setCell,
        getCellValue,
        isDirty,
        getError,
        dirty,
        saveAll,
        discardAll,
        refresh,
    ]);
}

function unitLabel(u: Unit) {
    return (u.unit_shortcut ?? u.unit_name ?? "").toString();
}
