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
    PriceChangeBatchLineInput,
    SavePriceChangeBatchInput,
    SaveAllResult,
    DirtyPreviewLine,
    DirtyCellMeta,
} from "../types";
import * as api from "../providers/pricingApi";
import { clampMoney, moneyValuesEqual, toNumberOrNull } from "../utils/format";
import {
    buildMatrixTierKeys,
    emptyPivot,
    isListTierKey,
    pivotPrices,
    tierLabelForTierKey,
} from "../utils/pivot";
import { validatePrice } from "../utils/validators";

type DirtyKey = `${number}:${ProductTierKey}`;
type PendingKey = `${number}:${ProductTierKey}`;



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

const defaultFilters: PricingFilters = {
    q: "",
    category_ids: [],
    brand_ids: [],
    unit_ids: [],
    supplier_ids: [],
    supplier_scope: "ALL",
    active_only: true,
    missing_tier: false,
    price_view: "FOCUSED",
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

    const matrixTierKeys = useMemo(() => buildMatrixTierKeys(priceTypes), [priceTypes]);
    const emptyPivotForTypes = useMemo(() => emptyPivot(priceTypes), [priceTypes]);

    const [filters, setFilters] = useState<PricingFilters>(defaultFilters);

    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);

    const [loading, setLoading] = useState(false);
    const [rows, setRows] = useState<MatrixRow[]>([]);
    const [meta, setMeta] = useState<ProductsMeta>(undefined);
    const [usedUnits, setUsedUnits] = useState<Unit[]>([]);

    const [dirty, setDirty] = useState<Map<DirtyKey, string>>(new Map());
    const [dirtyErrors, setDirtyErrors] = useState<Map<DirtyKey, string>>(new Map());
    const [dirtyMeta, setDirtyMeta] = useState<Map<DirtyKey, DirtyCellMeta>>(new Map());

    const [pendingMap, setPendingMap] = useState<Map<PendingKey, number>>(new Map());

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
                price_view: filters.price_view,
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
            filters.price_view,
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

            // Fetch pending requests
            const [pendingPriceRes, pendingCostRes] = await Promise.all([
                api.getPendingPriceRequests(),
                api.getPendingCostRequests()
            ]);

            const nextPending = new Map<PendingKey, number>();

            // Map price change requests
            for (const pcr of pendingPriceRes.data ?? []) {
                const pidRaw = pcr.product_id;
                const ptidRaw = pcr.price_type_id;
                const pid = toNumberOrNull(typeof pidRaw === "object" ? pidRaw?.product_id : pidRaw);
                const ptid = toNumberOrNull(typeof ptidRaw === "object" ? ptidRaw?.price_type_id : ptidRaw);
                if (pid !== null && ptid !== null) {
                    nextPending.set(`${pid}:${String(ptid)}`, toNumberOrNull(pcr.proposed_price) ?? 0);
                }
            }

            // Map cost change requests
            for (const ccr of pendingCostRes.data ?? []) {
                const pidRaw = ccr.product_id;
                const pid = toNumberOrNull(typeof pidRaw === "object" ? pidRaw?.product_id : pidRaw);
                if (pid !== null) {
                    nextPending.set(`${pid}:LIST`, toNumberOrNull(ccr.proposed_cost) ?? 0);
                }
            }

            setPendingMap(nextPending);

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
                    const piv =
                        productId !== null ? priceMap.get(productId) ?? emptyPivotForTypes : emptyPivotForTypes;

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
    }, [filters, page, pageSize, categoriesById, brandsById, unitsById, unitsList, priceTypes, emptyPivotForTypes]);

    useEffect(() => {
        refresh().catch((error: unknown) => {
            const message = error instanceof Error ? error.message : "Failed to load pricing matrix";
            toast.error(message);
        });
    }, [refresh]);

    const setCell = useCallback((productId: number, tier: ProductTierKey, raw: unknown) => {
        const key: DirtyKey = `${productId}:${tier}`;
        if (pendingMap.has(key)) return;

        const rawString = String(raw ?? "");

        if (!rawString.trim()) {
            setDirty((prev) => {
                const next = new Map(prev);
                next.delete(key);
                return next;
            });
            setDirtyErrors((prev) => {
                const next = new Map(prev);
                next.delete(key);
                return next;
            });
            setDirtyMeta((prev) => {
                const next = new Map(prev);
                next.delete(key);
                return next;
            });
            return;
        }

        const value = clampMoney(toNumberOrNull(rawString.trim()));
        const err = validatePrice(value);
        const meta = snapshotDirtyCellMeta(rows, productId, tier);

        if (moneyValuesEqual(value, meta.current_value)) {
            setDirty((prev) => {
                const next = new Map(prev);
                next.delete(key);
                return next;
            });
            setDirtyErrors((prev) => {
                const next = new Map(prev);
                next.delete(key);
                return next;
            });
            setDirtyMeta((prev) => {
                const next = new Map(prev);
                next.delete(key);
                return next;
            });
            return;
        }

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

        setDirtyMeta((prev) => {
            const next = new Map(prev);
            next.set(key, meta);
            return next;
        });
    }, [pendingMap, rows]);

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

    const getPendingValue = useCallback((productId: number, tier: ProductTierKey) => {
        return pendingMap.get(`${productId}:${tier}` as PendingKey) ?? null;
    }, [pendingMap]);

    const dirtyCounts = useMemo(() => {
        let price = 0;
        let cost = 0;

        for (const [key, raw] of dirty.entries()) {
            if (!raw.trim()) continue;
            const tier = key.slice(key.indexOf(":") + 1);
            if (isListTierKey(tier)) cost += 1;
            else price += 1;
        }

        return { price, cost };
    }, [dirty]);

    const visibleProductIds = useMemo(() => {
        const ids = new Set<number>();
        for (const row of rows) {
            for (const variant of Object.values(row.variantsByUnitId)) {
                const productId = toNumberOrNull(variant.product.product_id);
                if (productId !== null) ids.add(productId);
            }
        }
        return ids;
    }, [rows]);

    const offPageDirtyCount = useMemo(() => {
        let count = 0;
        for (const [key, raw] of dirty.entries()) {
            if (!raw.trim()) continue;
            const productId = Number(key.split(":")[0]);
            if (!Number.isFinite(productId) || !visibleProductIds.has(productId)) {
                count += 1;
            }
        }
        return count;
    }, [dirty, visibleProductIds]);

    const findCurrentPrice = useCallback((productId: number, tier: ProductTierKey) => {
        for (const row of rows) {
            for (const v of Object.values(row.variantsByUnitId)) {
                const pid = toNumberOrNull(v.product.product_id);
                if (pid === productId) {
                    return toNumberOrNull(v.tiers[tier]);
                }
            }
        }
        return null;
    }, [rows]);

    const dirtyPreviewLines = useMemo((): DirtyPreviewLine[] => {
        const lines: DirtyPreviewLine[] = [];

        for (const [k, price] of dirty.entries()) {
            const proposed = parseDirtyProposedValue(price);
            if (proposed === null || proposed === 0) continue;

            const productId = Number(k.slice(0, k.indexOf(":")));
            const tier = k.slice(k.indexOf(":") + 1);
            const meta = dirtyMeta.get(k);
            const product = findProductInRows(rows, productId);
            const product_name = meta?.product_name ?? product?.product_name ?? `Product #${productId}`;
            const product_code = meta?.product_code ?? product?.product_code ?? null;

            if (isListTierKey(tier)) {
                const current_cost =
                    meta?.current_value ??
                    (product ? toNumberOrNull(product.cost_per_unit) : null);

                lines.push({
                    product_id: productId,
                    product_name,
                    product_code,
                    tier_label: "List Cost",
                    kind: "cost",
                    current_value: current_cost,
                    proposed_value: proposed,
                });
                continue;
            }

            const priceTypeId = Number(tier);
            if (!Number.isFinite(priceTypeId) || priceTypeId <= 0) continue;

            lines.push({
                product_id: productId,
                product_name,
                product_code,
                tier_label: tierLabelForTierKey(tier, priceTypes),
                kind: "price",
                current_value: meta?.current_value ?? findCurrentPrice(productId, tier),
                proposed_value: proposed,
            });
        }

        return lines.sort((a, b) => {
            const nameCompare = a.product_name.localeCompare(b.product_name);
            if (nameCompare !== 0) return nameCompare;
            if (a.kind !== b.kind) return a.kind === "price" ? -1 : 1;
            return a.tier_label.localeCompare(b.tier_label);
        });
    }, [dirty, dirtyMeta, findCurrentPrice, priceTypes, rows]);

    const saveAll = useCallback(async (batch?: SavePriceChangeBatchInput): Promise<SaveAllResult> => {
        if (dirtyErrors.size > 0) {
            toast.error("Please fix validation errors before submitting.");
            return { success: false, reason: "validation" };
        }

        const hasNonemptyDirty = Array.from(dirty.values()).some((raw) => raw.trim().length > 0);
        if (!hasNonemptyDirty) {
            toast.message("No changes to submit.");
            return { success: false, reason: "no_changes" };
        }

        const pcrItems: PriceChangeBatchLineInput[] = [];
        const costPcrItems: { product_id: number; proposed_cost: number; current_cost: number | null }[] = [];

        for (const [k, price] of dirty.entries()) {
            const proposed = parseDirtyProposedValue(price);
            if (proposed === null || proposed === 0) continue;

            const productId = Number(k.slice(0, k.indexOf(":")));
            const tier = k.slice(k.indexOf(":") + 1);

            const meta = dirtyMeta.get(k);

            if (isListTierKey(tier)) {
                let current_cost = meta?.current_value ?? null;
                if (current_cost === null) {
                    rows_loop: for (const row of rows) {
                        for (const v of Object.values(row.variantsByUnitId)) {
                            const pid = toNumberOrNull(v.product.product_id);
                            if (pid === productId) {
                                current_cost = toNumberOrNull(v.product.cost_per_unit);
                                break rows_loop;
                            }
                        }
                    }
                }

                costPcrItems.push({
                    product_id: productId,
                    proposed_cost: proposed,
                    current_cost,
                });
                continue;
            }

            const priceTypeId = Number(tier);
            if (!Number.isFinite(priceTypeId) || priceTypeId <= 0) continue;

            pcrItems.push({
                product_id: productId,
                price_type_id: priceTypeId,
                current_price: meta?.current_value ?? findCurrentPrice(productId, tier),
                proposed_price: proposed,
            });
        }

        if (pcrItems.length === 0 && costPcrItems.length === 0) {
            toast.error("No valid changes to submit.");
            return { success: false, reason: "no_valid_lines" };
        }

        if (pcrItems.length > 0 && (!batch?.supplier_id || !batch.remarks.trim())) {
            toast.error("Supplier and batch remarks are required for price change batches.");
            return { success: false, reason: "missing_batch_fields" };
        }

        try {
            type CreateResult = {
                created?: number;
                skipped_existing_pending?: number;
                skipped_duplicates?: number;
            };

            let priceCreated = 0;
            let costCreated = 0;
            let totalSkippedDuplicates = 0;
            let totalSkippedExistingPending = 0;

            if (pcrItems.length > 0) {
                const priceRes = (await api.createPriceChangeBatch(batch!, pcrItems)) as CreateResult;
                priceCreated = priceRes.created ?? 0;
                totalSkippedDuplicates += priceRes.skipped_duplicates ?? 0;
                totalSkippedExistingPending += priceRes.skipped_existing_pending ?? 0;

                if (priceCreated === 0) {
                    if (totalSkippedExistingPending > 0) {
                        toast.message(
                            "No new price requests were created because these items already have pending requests.",
                        );
                    } else if (totalSkippedDuplicates > 0) {
                        toast.message("No new changes - all entries were duplicates.");
                    } else {
                        toast.message("No new price requests were created.");
                    }
                    return { success: false, reason: "nothing_created" };
                }
            }

            if (costPcrItems.length > 0) {
                try {
                    const costRes = (await api.createCostChangeRequests(costPcrItems)) as CreateResult;
                    costCreated = costRes.created ?? 0;
                    totalSkippedDuplicates += costRes.skipped_duplicates ?? 0;
                    totalSkippedExistingPending += costRes.skipped_existing_pending ?? 0;
                } catch (costError: unknown) {
                    if (priceCreated > 0) {
                        const cleared = clearPriceDirtyKeys(dirty, dirtyErrors, dirtyMeta, pcrItems);
                        setDirty(cleared.dirty);
                        setDirtyErrors(cleared.dirtyErrors);
                        setDirtyMeta(cleared.dirtyMeta);
                        await refresh();

                        const costMessage = formatSaveErrorMessage(costError);
                        toast.error(
                            `Price batch was created (${priceCreated} line(s)), but list cost updates failed: ${costMessage}`,
                        );
                        return { success: false, reason: "partial_failure", created: priceCreated };
                    }
                    throw costError;
                }
            }

            const totalCreated = priceCreated + costCreated;

            if (totalCreated > 0) {
                if (costPcrItems.length > 0 && costCreated === 0) {
                    const cleared = clearPriceDirtyKeys(dirty, dirtyErrors, dirtyMeta, pcrItems);
                    setDirty(cleared.dirty);
                    setDirtyErrors(cleared.dirtyErrors);
                    setDirtyMeta(cleared.dirtyMeta);
                    await refresh();

                    if (totalSkippedExistingPending > 0) {
                        toast.warning(
                            `Price batch created (${priceCreated} line(s)). List cost lines were not created because they already have pending requests.`,
                        );
                    } else {
                        toast.warning(
                            `Price batch created (${priceCreated} line(s)). No new list cost requests were created.`,
                        );
                    }
                    return { success: false, reason: "partial_failure", created: priceCreated };
                }

                setDirty(new Map());
                setDirtyErrors(new Map());
                setDirtyMeta(new Map());
                await refresh();

                const skippedMessages: string[] = [];
                if (totalSkippedExistingPending > 0) {
                    skippedMessages.push(`${totalSkippedExistingPending} already pending`);
                }
                if (totalSkippedDuplicates > 0) {
                    skippedMessages.push(`${totalSkippedDuplicates} duplicate(s) skipped`);
                }

                toast.success(
                    `${totalCreated} price change request(s) submitted successfully.${
                        skippedMessages.length ? ` ${skippedMessages.join(", ")}.` : ""
                    }`,
                );
                return { success: true, created: totalCreated };
            }

            if (totalSkippedExistingPending > 0) {
                toast.message("No new price requests were created because these items already have pending requests.");
                return { success: false, reason: "nothing_created" };
            }

            if (totalSkippedDuplicates > 0) {
                toast.message("No new changes - all entries were duplicates.");
                return { success: false, reason: "nothing_created" };
            }

            toast.message("No new price requests were created.");
            return { success: false, reason: "nothing_created" };
        } catch (error: unknown) {
            toast.error(formatSaveErrorMessage(error));
            return { success: false, reason: "api_error" };
        }
    }, [dirty, dirtyErrors, dirtyMeta, refresh, rows, findCurrentPrice]);

    const discardAll = useCallback(() => {
        setDirty(new Map());
        setDirtyErrors(new Map());
        setDirtyMeta(new Map());
    }, []);

    const resetFilters = useCallback(() => {
        setFilters(defaultFilters);
        setPage(1);
    }, []);

    return useMemo(() => ({
        TIERS: matrixTierKeys,
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
        getPendingValue,
        isDirty,
        getError,

        dirtyCount: dirtyCounts.price + dirtyCounts.cost,
        priceDirtyCount: dirtyCounts.price,
        costDirtyCount: dirtyCounts.cost,
        offPageDirtyCount,
        dirtyPreviewLines,
        saveAll,
        discardAll,

        refresh,
    }), [
        matrixTierKeys,
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
        getPendingValue,
        isDirty,
        getError,
        dirty,
        dirtyCounts,
        offPageDirtyCount,
        dirtyPreviewLines,
        saveAll,
        discardAll,
        refresh,
    ]);
}

function parseDirtyProposedValue(raw: string): number | null {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    return toNumberOrNull(trimmed);
}

function formatSaveErrorMessage(error: unknown): string {
    let displayMessage = "Failed to save changes";
    if (!(error instanceof Error)) return displayMessage;

    try {
        const parsed = JSON.parse(error.message) as Record<string, unknown>;
        const body = parsed.directus_body ?? parsed.body ?? parsed.details ?? parsed.error;
        if (typeof body === "string" && body.trim()) {
            try {
                const inner = JSON.parse(body) as Record<string, unknown>;
                const innerErrors = inner.errors;
                if (Array.isArray(innerErrors) && innerErrors.length > 0) {
                    const first = innerErrors[0] as Record<string, unknown>;
                    return String(first.message ?? body);
                }
                return body;
            } catch {
                return body;
            }
        }
        return error.message;
    } catch {
        return error.message;
    }
}

function clearPriceDirtyKeys(
    dirty: Map<DirtyKey, string>,
    dirtyErrors: Map<DirtyKey, string>,
    dirtyMeta: Map<DirtyKey, DirtyCellMeta>,
    pcrItems: PriceChangeBatchLineInput[],
) {
    const nextDirty = new Map(dirty);
    const nextDirtyErrors = new Map(dirtyErrors);
    const nextDirtyMeta = new Map(dirtyMeta);

    for (const item of pcrItems) {
        const key: DirtyKey = `${item.product_id}:${String(item.price_type_id)}`;
        nextDirty.delete(key);
        nextDirtyErrors.delete(key);
        nextDirtyMeta.delete(key);
    }

    return { dirty: nextDirty, dirtyErrors: nextDirtyErrors, dirtyMeta: nextDirtyMeta };
}

function snapshotDirtyCellMeta(
    rows: MatrixRow[],
    productId: number,
    tier: ProductTierKey,
): DirtyCellMeta {
    const product = findProductInRows(rows, productId);
    let current_value: number | null = null;

    if (isListTierKey(tier)) {
        current_value = product ? toNumberOrNull(product.cost_per_unit) : null;
    } else {
        for (const row of rows) {
            for (const variant of Object.values(row.variantsByUnitId)) {
                const pid = toNumberOrNull(variant.product.product_id);
                if (pid === productId) {
                    current_value = toNumberOrNull(variant.tiers[tier]);
                    break;
                }
            }
            if (current_value !== null) break;
        }
    }

    return {
        product_name: product?.product_name ?? `Product #${productId}`,
        product_code: product?.product_code ?? null,
        current_value,
    };
}

function findProductInRows(rows: MatrixRow[], productId: number): ProductRow | null {
    for (const row of rows) {
        for (const variant of Object.values(row.variantsByUnitId)) {
            if (toNumberOrNull(variant.product.product_id) === productId) {
                return variant.product;
            }
        }
    }
    return null;
}

function unitLabel(u: Unit) {
    return (u.unit_shortcut ?? u.unit_name ?? "").toString();
}
