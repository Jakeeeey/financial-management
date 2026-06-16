"use client";

import * as React from "react";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PriceControlSearchableSelect } from "../../shared/PriceControlSearchableSelect";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import * as api from "../providers/pcrApi";
import type { BatchImportPrefill, CreateCCRPayload, CreatePriceChangeBatchPayload } from "../types";
import { buildTierPriceMap, lookupTierPrice } from "../utils/tierPriceLookup";
import {
    buildVariantGroupIndex,
    childVariantIdsForGroup,
    groupIdFor,
    isChildVariant,
} from "../utils/variantPropagation";
import { BatchPriceGrid } from "./BatchPriceGrid";
import { useEditableGridNavigation } from "./useEditableGridNavigation";

type FieldErrors = Partial<Record<"supplier_id" | "remarks" | "lines", string>>;

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    suppliers: api.SupplierOption[];
    onCreated: () => void;
    importPrefill?: BatchImportPrefill | null;
};

function safeStr(value: unknown): string {
    const text = String(value ?? "").trim();
    return text && text !== "undefined" && text !== "null" ? text : "";
}

function supplierText(supplier: api.SupplierOption): string {
    const shortcut = safeStr(supplier.supplier_shortcut);
    const name = safeStr(supplier.supplier_name);
    return shortcut ? `${shortcut} - ${name}` : name || `Supplier #${supplier.id}`;
}

function formatMoney(value: number | null | undefined) {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) return "-";
    return Number(value).toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function priceTypeLabel(priceType: api.PriceTypeOption) {
    return safeStr(priceType.price_type_name) || `#${priceType.price_type_id}`;
}

function sortPriceTypes(priceTypes: api.PriceTypeOption[]) {
    return [...priceTypes].sort((a, b) => {
        const aSort = Number(a.sort ?? Number.MAX_SAFE_INTEGER);
        const bSort = Number(b.sort ?? Number.MAX_SAFE_INTEGER);
        return aSort - bSort || priceTypeLabel(a).localeCompare(priceTypeLabel(b));
    });
}

function cellKey(productId: number, priceTypeId: number) {
    return `${productId}:${priceTypeId}`;
}

function parsePriceInput(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return { value: null, error: null };

    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) return { value: null, error: "Invalid price" };
    if (parsed < 0) return { value: null, error: "Must be 0 or higher" };

    return { value: parsed, error: null };
}

function summarizeCreated(result: {
    created: number;
    skipped_duplicates?: number;
    skipped_existing_pending?: number;
}) {
    const details: string[] = [];
    if (result.skipped_duplicates) details.push(`${result.skipped_duplicates} duplicate(s) skipped`);
    if (result.skipped_existing_pending) details.push(`${result.skipped_existing_pending} already pending`);
    return details.length ? ` ${details.join(", ")}.` : "";
}

const DEFAULT_CATALOG_PAGE_SIZE = 50;

export function CreatePriceChangeBatchDialog({
    open,
    onOpenChange,
    suppliers,
    onCreated,
    importPrefill = null,
}: Props) {
    const [supplierId, setSupplierId] = React.useState("");
    const [referenceNo, setReferenceNo] = React.useState("");
    const [remarks, setRemarks] = React.useState("");
    const [errors, setErrors] = React.useState<FieldErrors>({});
    const [applyParentPriceToChildren, setApplyParentPriceToChildren] = React.useState(false);

    const [priceTypes, setPriceTypes] = React.useState<api.PriceTypeOption[]>([]);
    const [products, setProducts] = React.useState<api.ProductSearchRow[]>([]);
    const [productCatalog, setProductCatalog] = React.useState<Map<number, api.ProductSearchRow>>(new Map());
    const [tierPriceMap, setTierPriceMap] = React.useState<Map<string, number | null>>(new Map());
    const [draftPrices, setDraftPrices] = React.useState<Map<string, string>>(new Map());
    const [draftCosts, setDraftCosts] = React.useState<Map<number, string>>(new Map());
    const [currentCostMap, setCurrentCostMap] = React.useState<Map<number, number | null>>(new Map());
    const [catalogPage, setCatalogPage] = React.useState(1);
    const [catalogPageSize, setCatalogPageSize] = React.useState(DEFAULT_CATALOG_PAGE_SIZE);
    const [catalogTotal, setCatalogTotal] = React.useState(0);
    const [catalogTotalVariants, setCatalogTotalVariants] = React.useState(0);
    const [catalogTotalPages, setCatalogTotalPages] = React.useState(0);
    const [catalogQuery, setCatalogQuery] = React.useState("");
    const [localCatalogQ, setLocalCatalogQ] = React.useState("");
    const [variantGroupIndex, setVariantGroupIndex] = React.useState<Map<number, number[]>>(new Map());
    const [loadingPriceTypes, setLoadingPriceTypes] = React.useState(false);
    const [loadingProducts, setLoadingProducts] = React.useState(false);
    const [loadingVariantIndex, setLoadingVariantIndex] = React.useState(false);
    const [loadError, setLoadError] = React.useState<string | null>(null);
    const [saving, setSaving] = React.useState(false);
    const [importedProductIds, setImportedProductIds] = React.useState<number[]>([]);
    const [catalogViewMode, setCatalogViewMode] = React.useState<"catalog" | "imported">("catalog");

    const productCatalogRef = React.useRef(productCatalog);
    const tierPriceMapRef = React.useRef(tierPriceMap);
    productCatalogRef.current = productCatalog;
    tierPriceMapRef.current = tierPriceMap;

    const resetCatalogState = React.useCallback(() => {
        setProducts([]);
        setProductCatalog(new Map());
        setTierPriceMap(new Map());
        setDraftPrices(new Map());
        setDraftCosts(new Map());
        setCurrentCostMap(new Map());
        setVariantGroupIndex(new Map());
        setCatalogPage(1);
        setCatalogPageSize(DEFAULT_CATALOG_PAGE_SIZE);
        setCatalogTotal(0);
        setCatalogTotalVariants(0);
        setCatalogTotalPages(0);
        setCatalogQuery("");
        setLocalCatalogQ("");
    }, []);

    React.useEffect(() => {
        if (!open) {
            setSupplierId("");
            setReferenceNo("");
            setRemarks("");
            setErrors({});
            setApplyParentPriceToChildren(false);
            resetCatalogState();
            setLoadError(null);
            setSaving(false);
            setImportedProductIds([]);
            setCatalogViewMode("catalog");
        }
    }, [open, resetCatalogState]);

    React.useEffect(() => {
        if (!open || !importPrefill) return;

        setSupplierId(String(importPrefill.supplierId));
        setRemarks(importPrefill.remarks);
        setReferenceNo("");
        setErrors({});
        setProductCatalog(new Map(importPrefill.productCatalog));
        setTierPriceMap(new Map(importPrefill.tierPriceMap));
        setDraftPrices(new Map(importPrefill.draftPrices));
        setDraftCosts(new Map(importPrefill.draftCosts));
        setCurrentCostMap(new Map(importPrefill.currentCostMap));
        setImportedProductIds(importPrefill.importedProductIds);
        setCatalogViewMode("imported");
        setCatalogPage(1);
        setCatalogQuery("");
        setLocalCatalogQ("");
    }, [open, importPrefill]);

    React.useEffect(() => {
        if (!open) return;

        let alive = true;
        setLoadingPriceTypes(true);

        api.getPriceTypes()
            .then((result) => {
                if (!alive) return;
                setPriceTypes(sortPriceTypes(result.data ?? []));
            })
            .catch((error: unknown) => {
                if (!alive) return;
                setPriceTypes([]);
                setLoadError(error instanceof Error ? error.message : "Failed to load price types");
            })
            .finally(() => {
                if (alive) setLoadingPriceTypes(false);
            });

        return () => {
            alive = false;
        };
    }, [open]);

    React.useEffect(() => {
        if (!open || !supplierId) return;

        let alive = true;
        setLoadingProducts(true);
        setLoadError(null);

        api.getProductsPage({
            supplier_ids: supplierId,
            supplier_scope: "LINKED_ONLY",
            active_only: "1",
            page: String(catalogPage),
            page_size: String(catalogPageSize),
            q: catalogQuery || undefined,
        })
            .then(async (result) => {
                if (!alive) return;

                const productIds = result.data.map((row) => row.product_id);
                const priceResult = await api.getPricesForProducts(productIds);
                if (!alive) return;

                setProducts(result.data);
                setCatalogTotal(Number(result.meta?.total ?? result.data.length));
                setCatalogTotalVariants(Number(result.meta?.totalVariants ?? result.data.length));
                setCatalogTotalPages(Math.max(0, Number(result.meta?.totalPages ?? 0)));
                setProductCatalog((prev) => {
                    const next = new Map(prev);
                    for (const row of result.data) {
                        next.set(row.product_id, row);
                    }
                    return next;
                });
                setTierPriceMap((prev) => {
                    const next = new Map(prev);
                    for (const [key, value] of buildTierPriceMap(priceResult.data)) {
                        next.set(key, value);
                    }
                    return next;
                });
            })
            .catch((error: unknown) => {
                if (!alive) return;
                setProducts([]);
                setLoadError(error instanceof Error ? error.message : "Failed to load supplier products");
            })
            .finally(() => {
                if (alive) setLoadingProducts(false);
            });

        return () => {
            alive = false;
        };
    }, [open, supplierId, catalogPage, catalogPageSize, catalogQuery]);

    React.useEffect(() => {
        if (!open || !supplierId) {
            setVariantGroupIndex(new Map());
            return;
        }

        let alive = true;
        setLoadingVariantIndex(true);

        api.getVariantGroups({
            supplier_ids: supplierId,
            supplier_scope: "LINKED_ONLY",
            active_only: "1",
        })
            .then((result) => {
                if (!alive) return;
                setVariantGroupIndex(buildVariantGroupIndex(result.groups));
            })
            .catch((error: unknown) => {
                if (!alive) return;
                setVariantGroupIndex(new Map());
                setLoadError(error instanceof Error ? error.message : "Failed to load product variant groups");
            })
            .finally(() => {
                if (alive) setLoadingVariantIndex(false);
            });

        return () => {
            alive = false;
        };
    }, [open, supplierId]);

    const ensureCatalogHydrated = React.useCallback(async (productIds: number[]) => {
        const missing = productIds.filter((id) => !productCatalogRef.current.has(id));
        if (missing.length === 0) return;

        const [rows, priceResult] = await Promise.all([
            api.getProductsByIds(missing),
            api.getPricesForProducts(missing),
        ]);

        setProductCatalog((prev) => {
            const next = new Map(prev);
            for (const row of rows) {
                next.set(row.product_id, row);
                productCatalogRef.current.set(row.product_id, row);
            }
            return next;
        });

        setTierPriceMap((prev) => {
            const next = new Map(prev);
            for (const [key, value] of buildTierPriceMap(priceResult.data)) {
                next.set(key, value);
                tierPriceMapRef.current.set(key, value);
            }
            return next;
        });
    }, []);

    const handleSupplierChange = React.useCallback(
        (value: string) => {
            setSupplierId(value);
            setErrors((prev) => ({ ...prev, supplier_id: undefined }));
            resetCatalogState();
        },
        [resetCatalogState],
    );

    const applyCatalogSearch = React.useCallback(() => {
        setCatalogQuery(localCatalogQ.trim());
        setCatalogPage(1);
    }, [localCatalogQ]);

    const importedProducts = React.useMemo(() => {
        return importedProductIds
            .map((productId) => productCatalog.get(productId))
            .filter((product): product is api.ProductSearchRow => Boolean(product));
    }, [importedProductIds, productCatalog]);

    const gridProducts = catalogViewMode === "imported" ? importedProducts : products;
    const showingImportedView = catalogViewMode === "imported" && importedProductIds.length > 0;

    const catalogStartIndex =
        catalogTotal > 0 && products.length > 0 ? (catalogPage - 1) * catalogPageSize + 1 : 0;
    const catalogEndIndex =
        catalogTotal > 0 && products.length > 0 ? catalogStartIndex + products.length - 1 : 0;
    const canCatalogPrev = catalogPage > 1;
    const canCatalogNext = catalogTotalPages > 0 ? catalogPage < catalogTotalPages : false;

    const supplierOptions = React.useMemo(
        () =>
            suppliers.map((supplier) => ({
                value: String(supplier.id),
                label: supplierText(supplier),
            })),
        [suppliers],
    );

    const priceTypesById = React.useMemo(() => {
        const map = new Map<number, api.PriceTypeOption>();
        for (const priceType of priceTypes) map.set(priceType.price_type_id, priceType);
        return map;
    }, [priceTypes]);

    const currentPriceFor = React.useCallback(
        (product: api.ProductSearchRow, priceType: api.PriceTypeOption) =>
            lookupTierPrice(tierPriceMapRef.current, product.product_id, priceType.price_type_id),
        [],
    );

    const collectChildIdsForPropagation = React.useCallback(
        (drafts: Map<string, string>) => {
            const childIds = new Set<number>();

            for (const [key] of drafts) {
                const [productIdText, priceTypeIdText] = key.split(":");
                const productId = Number(productIdText);
                const priceTypeId = Number(priceTypeIdText);
                if (!Number.isFinite(productId) || !Number.isFinite(priceTypeId)) continue;

                const product = productCatalogRef.current.get(productId);
                if (!product || isChildVariant(product)) continue;

                const groupId = Number(groupIdFor(product));
                for (const childId of childVariantIdsForGroup(variantGroupIndex, groupId, productId)) {
                    childIds.add(childId);
                }
            }

            return Array.from(childIds);
        },
        [variantGroupIndex],
    );

    const validation = React.useMemo(() => {
        let validPriceCount = 0;
        let validCostCount = 0;
        const invalidPriceKeys = new Set<string>();
        const invalidCostIds = new Set<number>();

        for (const [key, raw] of draftPrices) {
            const result = parsePriceInput(raw);
            if (result.error) invalidPriceKeys.add(key);
            if (result.value !== null) validPriceCount += 1;
        }

        for (const [productId, raw] of draftCosts) {
            const result = parsePriceInput(raw);
            if (result.error) invalidCostIds.add(productId);
            if (result.value !== null) validCostCount += 1;
        }

        return {
            validPriceCount,
            validCostCount,
            validCount: validPriceCount + validCostCount,
            invalidPriceKeys,
            invalidCostIds,
            invalidKeys: invalidPriceKeys,
        };
    }, [draftCosts, draftPrices]);

    const showListCost = draftCosts.size > 0;

    const currentCostFor = React.useCallback(
        (product: api.ProductSearchRow) => currentCostMap.get(product.product_id) ?? null,
        [currentCostMap],
    );

    const setDraftCost = React.useCallback((product: api.ProductSearchRow, value: string) => {
        setDraftCosts((prev) => {
            const next = new Map(prev);
            if (value.trim()) next.set(product.product_id, value);
            else next.delete(product.product_id);
            return next;
        });
        setErrors((prev) => ({ ...prev, lines: undefined }));
    }, []);

    const setDraftPrice = React.useCallback(
        (product: api.ProductSearchRow, priceTypeId: number, value: string) => {
            let hydrateIds: number[] = [];

            setDraftPrices((prev) => {
                const next = new Map(prev);
                const keysToUpdate = [cellKey(product.product_id, priceTypeId)];

                if (applyParentPriceToChildren && !isChildVariant(product)) {
                    const groupId = Number(groupIdFor(product));
                    for (const childId of childVariantIdsForGroup(
                        variantGroupIndex,
                        groupId,
                        product.product_id,
                    )) {
                        keysToUpdate.push(cellKey(childId, priceTypeId));
                    }
                }

                for (const key of keysToUpdate) {
                    if (value.trim()) next.set(key, value);
                    else next.delete(key);
                }

                if (applyParentPriceToChildren && !isChildVariant(product) && value.trim()) {
                    hydrateIds = childVariantIdsForGroup(
                        variantGroupIndex,
                        Number(groupIdFor(product)),
                        product.product_id,
                    );
                }

                return next;
            });

            if (hydrateIds.length > 0) {
                void ensureCatalogHydrated(hydrateIds);
            }

            setErrors((prev) => ({ ...prev, lines: undefined }));
        },
        [applyParentPriceToChildren, ensureCatalogHydrated, variantGroupIndex],
    );

    const buildLines = React.useCallback((): CreatePriceChangeBatchPayload["lines"] => {
        const lines: CreatePriceChangeBatchPayload["lines"] = [];
        const coveredKeys = new Set<string>();
        const catalog = productCatalogRef.current;

        const addLine = (productId: number, priceTypeId: number, raw: string) => {
            const key = cellKey(productId, priceTypeId);
            if (coveredKeys.has(key)) return;

            const product = catalog.get(productId);
            const priceType = priceTypesById.get(priceTypeId);
            const parsed = parsePriceInput(raw);

            if (!product || !priceType || parsed.value === null || parsed.error) return;

            coveredKeys.add(key);
            lines.push({
                product_id: product.product_id,
                price_type_id: priceType.price_type_id,
                current_price: currentPriceFor(product, priceType),
                proposed_price: parsed.value,
            });
        };

        for (const [key, raw] of draftPrices) {
            const [productIdText, priceTypeIdText] = key.split(":");
            addLine(Number(productIdText), Number(priceTypeIdText), raw);
        }

        if (applyParentPriceToChildren) {
            for (const [key, raw] of draftPrices) {
                const [productIdText, priceTypeIdText] = key.split(":");
                const productId = Number(productIdText);
                const priceTypeId = Number(priceTypeIdText);
                const product = catalog.get(productId);

                if (!product || isChildVariant(product)) continue;

                const groupId = Number(groupIdFor(product));
                for (const childId of childVariantIdsForGroup(variantGroupIndex, groupId, productId)) {
                    const childKey = cellKey(childId, priceTypeId);
                    if (draftPrices.has(childKey)) continue;
                    addLine(childId, priceTypeId, raw);
                }
            }
        }

        return lines;
    }, [applyParentPriceToChildren, currentPriceFor, draftPrices, priceTypesById, variantGroupIndex]);

    const buildCostLines = React.useCallback((): CreateCCRPayload[] => {
        const items: CreateCCRPayload[] = [];
        const catalog = productCatalogRef.current;

        for (const [productId, raw] of draftCosts) {
            const parsed = parsePriceInput(raw);
            if (parsed.value === null || parsed.error) continue;

            const product = catalog.get(productId);
            if (!product) continue;

            items.push({
                product_id: productId,
                proposed_cost: parsed.value,
                current_cost: currentCostMap.get(productId) ?? null,
            });
        }

        return items;
    }, [currentCostMap, draftCosts]);

    React.useEffect(() => {
        if (!applyParentPriceToChildren || variantGroupIndex.size === 0 || draftPrices.size === 0) {
            return;
        }

        let hydrateIds: number[] = [];

        setDraftPrices((prev) => {
            const next = new Map(prev);
            let changed = false;

            for (const [key, raw] of prev) {
                const [productIdText, priceTypeIdText] = key.split(":");
                const productId = Number(productIdText);
                const priceTypeId = Number(priceTypeIdText);
                const product = productCatalogRef.current.get(productId);

                if (!product || isChildVariant(product)) continue;

                const groupId = Number(groupIdFor(product));
                for (const childId of childVariantIdsForGroup(variantGroupIndex, groupId, productId)) {
                    const childKey = cellKey(childId, priceTypeId);
                    if (!next.has(childKey)) {
                        next.set(childKey, raw);
                        changed = true;
                    }
                }
            }

            if (changed) {
                hydrateIds = collectChildIdsForPropagation(next);
            }

            return changed ? next : prev;
        });

        if (hydrateIds.length > 0) {
            void ensureCatalogHydrated(hydrateIds);
        }
    }, [
        applyParentPriceToChildren,
        collectChildIdsForPropagation,
        draftPrices.size,
        ensureCatalogHydrated,
        variantGroupIndex,
    ]);

    const gridNav = useEditableGridNavigation({
        rowCount: gridProducts.length,
        colCount: priceTypes.length + (showListCost ? 1 : 0),
        disabled: saving,
        onPasteSkipped: (count) => {
            toast.warning(
                `${count} pasted cell(s) skipped. Only non-negative numbers are accepted.`,
            );
        },
    });

    const catalogLoading = loadingPriceTypes || loadingProducts || loadingVariantIndex;

    const canSubmit =
        !saving &&
        !catalogLoading &&
        Boolean(supplierId) &&
        Boolean(remarks.trim()) &&
        validation.validCount > 0 &&
        validation.invalidPriceKeys.size === 0 &&
        validation.invalidCostIds.size === 0;

    const handleSubmit = React.useCallback(async () => {
        const nextErrors: FieldErrors = {};
        const selectedSupplierId = Number(supplierId);
        const trimmedRemarks = remarks.trim();
        const trimmedReferenceNo = referenceNo.trim();

        if (!Number.isFinite(selectedSupplierId) || selectedSupplierId <= 0) {
            nextErrors.supplier_id = "Supplier is required.";
        }
        if (!trimmedRemarks) {
            nextErrors.remarks = "Remarks is required.";
        }
        if (validation.invalidPriceKeys.size > 0 || validation.invalidCostIds.size > 0) {
            nextErrors.lines = "Fix invalid proposed prices or list costs before submitting.";
        }

        setErrors(nextErrors);
        if (Object.keys(nextErrors).length > 0) return;

        setSaving(true);
        try {
            if (applyParentPriceToChildren) {
                await ensureCatalogHydrated(collectChildIdsForPropagation(draftPrices));
            }

            const priceLines = buildLines();
            const costItems = buildCostLines();

            if (priceLines.length === 0 && costItems.length === 0) {
                setErrors({ lines: "Enter at least one proposed price or list cost." });
                return;
            }

            const batchPayload = {
                supplier_id: selectedSupplierId,
                reference_no: trimmedReferenceNo || undefined,
                remarks: trimmedRemarks,
            };

            if (priceLines.length > 0 && costItems.length > 0) {
                const result = await api.saveMixedPricingChanges({
                    batch: batchPayload,
                    price_lines: priceLines,
                    cost_items: costItems,
                });

                const created = Number(result.created ?? 0);
                if (created > 0) {
                    toast.success(
                        `Created ${result.price.created ?? 0} price line(s) and ${result.cost.created ?? 0} list cost line(s).`,
                    );
                    onCreated();
                    onOpenChange(false);
                } else {
                    toast.info("No pending records were created.");
                }
                return;
            }

            if (priceLines.length > 0) {
                const result = await api.createPriceChangeBatch({
                    ...batchPayload,
                    lines: priceLines,
                });

                const created = Number(result.created ?? 0);
                if (created > 0) {
                    toast.success(`Created price change batch with ${created} line(s).${summarizeCreated(result)}`);
                    onCreated();
                    onOpenChange(false);
                } else {
                    toast.info(`No batch was created.${summarizeCreated(result)}`);
                }
                return;
            }

            const result = await api.createBulkCostChangeRequests({
                items: costItems,
                reference_no: trimmedReferenceNo || undefined,
                remarks: trimmedRemarks,
            });

            const created = Number(result.created ?? 0);
            if (created > 0) {
                toast.success(`Created list cost batch with ${created} line(s).${summarizeCreated(result)}`);
                onCreated();
                onOpenChange(false);
            } else {
                toast.info(`No list cost batch was created.${summarizeCreated(result)}`);
            }
        } catch (error: unknown) {
            toast.error(error instanceof Error ? error.message : "Failed to create price change batch");
        } finally {
            setSaving(false);
        }
    }, [
        applyParentPriceToChildren,
        buildCostLines,
        buildLines,
        collectChildIdsForPropagation,
        draftPrices,
        ensureCatalogHydrated,
        onCreated,
        onOpenChange,
        referenceNo,
        remarks,
        supplierId,
        validation.invalidCostIds.size,
        validation.invalidPriceKeys.size,
    ]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-6xl">
                <DialogHeader>
                    <DialogTitle>New Price Change Batch</DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="grid gap-3 lg:grid-cols-[minmax(220px,0.8fr)_minmax(180px,0.55fr)_minmax(260px,1fr)]">
                        <div className="grid gap-2">
                            <Label>
                                Supplier <span className="text-destructive">*</span>
                            </Label>
                            <PriceControlSearchableSelect
                                options={supplierOptions}
                                value={supplierId}
                                onValueChange={handleSupplierChange}
                                placeholder="Select supplier"
                                disabled={suppliers.length === 0 || saving || showingImportedView}
                            />
                            {errors.supplier_id ? (
                                <p className="text-xs text-destructive">{errors.supplier_id}</p>
                            ) : null}
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="price-change-batch-reference">Reference No.</Label>
                            <Input
                                id="price-change-batch-reference"
                                value={referenceNo}
                                onChange={(event) => setReferenceNo(event.target.value)}
                                placeholder="Reference number"
                                disabled={saving}
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="price-change-batch-remarks">
                                Remarks <span className="text-destructive">*</span>
                            </Label>
                            <Textarea
                                id="price-change-batch-remarks"
                                value={remarks}
                                onChange={(event) => {
                                    setRemarks(event.target.value);
                                    setErrors((prev) => ({ ...prev, remarks: undefined }));
                                }}
                                rows={3}
                                aria-invalid={Boolean(errors.remarks)}
                                disabled={saving}
                            />
                            {errors.remarks ? <p className="text-xs text-destructive">{errors.remarks}</p> : null}
                        </div>
                    </div>

                    <div className="rounded-md border">
                        <div className="flex flex-col gap-2 border-b bg-muted/30 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                                <div className="font-medium">Supplier Catalog</div>
                                {importedProductIds.length > 0 ? (
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant={catalogViewMode === "imported" ? "default" : "outline"}
                                            onClick={() => setCatalogViewMode("imported")}
                                            disabled={saving}
                                        >
                                            Imported ({importedProductIds.length})
                                        </Button>
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant={catalogViewMode === "catalog" ? "default" : "outline"}
                                            onClick={() => setCatalogViewMode("catalog")}
                                            disabled={saving}
                                        >
                                            Full Catalog
                                        </Button>
                                    </div>
                                ) : null}
                                <div className="flex items-center gap-2">
                                    <Switch
                                        id="apply-parent-price-to-children"
                                        checked={applyParentPriceToChildren}
                                        onCheckedChange={setApplyParentPriceToChildren}
                                        disabled={saving}
                                    />
                                    <Label
                                        htmlFor="apply-parent-price-to-children"
                                        className="text-xs font-normal text-muted-foreground"
                                    >
                                        Apply parent prices to child variants
                                    </Label>
                                </div>
                                {applyParentPriceToChildren ? (
                                    <p className="text-[11px] leading-snug text-muted-foreground">
                                        Applies to all unit variants in each product group, including variants on
                                        other catalog pages.
                                    </p>
                                ) : null}
                            </div>
                            <div className="flex flex-col items-end gap-0.5 text-xs text-muted-foreground">
                                <div>
                                    {validation.validPriceCount} price cell(s)
                                    {validation.validCostCount > 0
                                        ? ` · ${validation.validCostCount} list cost cell(s)`
                                        : ""}
                                </div>
                                <div>
                                    Tab/Enter to move · Paste from Excel · Edits kept across pages · Invalid
                                    values (text or negatives) are skipped
                                </div>
                            </div>
                        </div>

                        {supplierId && !showingImportedView ? (
                            <div className="flex flex-col gap-2 border-b px-3 py-2 sm:flex-row sm:items-center">
                                <div className="flex min-w-0 flex-1 items-center gap-2">
                                    <Search className="size-4 shrink-0 text-muted-foreground" />
                                    <Input
                                        value={localCatalogQ}
                                        onChange={(event) => setLocalCatalogQ(event.target.value)}
                                        onKeyDown={(event) => {
                                            if (event.key === "Enter") {
                                                event.preventDefault();
                                                applyCatalogSearch();
                                            }
                                        }}
                                        placeholder="Search product name or code"
                                        className="h-9"
                                        disabled={saving || loadingProducts}
                                    />
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        onClick={applyCatalogSearch}
                                        disabled={saving || loadingProducts}
                                    >
                                        Search
                                    </Button>
                                </div>
                            </div>
                        ) : null}

                        {loadError ? (
                            <div className="px-3 py-3 text-sm text-destructive">{loadError}</div>
                        ) : !supplierId ? (
                            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                                Select a supplier to load linked products.
                            </div>
                        ) : !showingImportedView && catalogLoading ? (
                            <div className="flex items-center justify-center gap-2 px-3 py-8 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Loading catalog
                            </div>
                        ) : priceTypes.length === 0 ? (
                            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                                No price types found.
                            </div>
                        ) : gridProducts.length === 0 ? (
                            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                                {showingImportedView
                                    ? "No imported products to display."
                                    : catalogQuery
                                      ? "No products match your search."
                                      : "No linked products found for this supplier."}
                            </div>
                        ) : (
                            <>
                                <BatchPriceGrid
                                    products={gridProducts}
                                    priceTypes={priceTypes}
                                    draftPrices={draftPrices}
                                    saving={saving}
                                    gridNav={gridNav}
                                    cellKey={cellKey}
                                    formatMoney={formatMoney}
                                    priceTypeLabel={priceTypeLabel}
                                    currentPriceFor={currentPriceFor}
                                    parsePriceInput={parsePriceInput}
                                    groupIdFor={groupIdFor}
                                    isChildVariant={isChildVariant}
                                    onDraftPriceChange={setDraftPrice}
                                    showListCost={showListCost}
                                    draftCosts={draftCosts}
                                    currentCostFor={currentCostFor}
                                    onDraftCostChange={setDraftCost}
                                />
                                {showingImportedView ? (
                                    <div className="border-t px-3 py-3 text-sm text-muted-foreground">
                                        Showing{" "}
                                        <span className="font-medium text-foreground">
                                            {gridProducts.length}
                                        </span>{" "}
                                        imported product{gridProducts.length === 1 ? "" : "s"} with proposed
                                        changes.
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-3 border-t px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="text-sm text-muted-foreground">
                                        Showing{" "}
                                        <span className="font-medium text-foreground">{catalogStartIndex}</span> -{" "}
                                        <span className="font-medium text-foreground">{catalogEndIndex}</span>
                                        {catalogTotal > 0 ? (
                                            <>
                                                {" "}
                                                of <span className="font-medium text-foreground">{catalogTotal}</span>{" "}
                                                product groups
                                                {catalogTotalVariants > 0 ? (
                                                    <>
                                                        {" "}
                                                        (
                                                        <span className="font-medium text-foreground">
                                                            {catalogTotalVariants}
                                                        </span>{" "}
                                                        variants)
                                                    </>
                                                ) : null}
                                            </>
                                        ) : (
                                            " product groups"
                                        )}
                                    </div>
                                    <div className="flex flex-wrap items-center justify-end gap-2">
                                        <select
                                            className={cn("h-9 rounded-md border bg-background px-2 text-sm")}
                                            value={String(catalogPageSize)}
                                            onChange={(event) => {
                                                setCatalogPageSize(Number(event.target.value));
                                                setCatalogPage(1);
                                            }}
                                            disabled={saving || loadingProducts}
                                        >
                                            {[25, 50, 100].map((size) => (
                                                <option key={size} value={String(size)}>
                                                    {size} / page
                                                </option>
                                            ))}
                                        </select>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            disabled={!canCatalogPrev || saving || loadingProducts}
                                            onClick={() => setCatalogPage((page) => Math.max(1, page - 1))}
                                        >
                                            Prev
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            disabled={!canCatalogNext || saving || loadingProducts}
                                            onClick={() =>
                                                setCatalogPage((page) =>
                                                    catalogTotalPages > 0
                                                        ? Math.min(catalogTotalPages, page + 1)
                                                        : page + 1,
                                                )
                                            }
                                        >
                                            Next
                                        </Button>
                                    </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {errors.lines ? <p className="text-sm text-destructive">{errors.lines}</p> : null}

                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                            Cancel
                        </Button>
                        <Button onClick={handleSubmit} disabled={!canSubmit}>
                            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Create Batch
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
