"use client";

import * as React from "react";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import * as api from "../providers/pcrApi";
import type { CreatePriceChangeBatchPayload } from "../types";
import { buildTierPriceMap, lookupTierPrice } from "../utils/tierPriceLookup";
import { BatchPriceGrid } from "./BatchPriceGrid";
import { useEditableGridNavigation } from "./useEditableGridNavigation";

type FieldErrors = Partial<Record<"supplier_id" | "remarks" | "lines", string>>;

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    suppliers: api.SupplierOption[];
    onCreated: () => void;
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

function groupIdFor(product: api.ProductSearchRow) {
    return product.__group_id ?? product.parent_id ?? product.product_id;
}

function isChildVariant(product: api.ProductSearchRow) {
    return Boolean(product.parent_id && Number(product.parent_id) !== Number(product.product_id));
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
    const [catalogPage, setCatalogPage] = React.useState(1);
    const [catalogPageSize, setCatalogPageSize] = React.useState(DEFAULT_CATALOG_PAGE_SIZE);
    const [catalogTotal, setCatalogTotal] = React.useState(0);
    const [catalogTotalPages, setCatalogTotalPages] = React.useState(0);
    const [catalogQuery, setCatalogQuery] = React.useState("");
    const [localCatalogQ, setLocalCatalogQ] = React.useState("");
    const [loadingPriceTypes, setLoadingPriceTypes] = React.useState(false);
    const [loadingProducts, setLoadingProducts] = React.useState(false);
    const [loadError, setLoadError] = React.useState<string | null>(null);
    const [saving, setSaving] = React.useState(false);

    const resetCatalogState = React.useCallback(() => {
        setProducts([]);
        setProductCatalog(new Map());
        setTierPriceMap(new Map());
        setDraftPrices(new Map());
        setCatalogPage(1);
        setCatalogPageSize(DEFAULT_CATALOG_PAGE_SIZE);
        setCatalogTotal(0);
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
        }
    }, [open, resetCatalogState]);

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
            lookupTierPrice(tierPriceMap, product.product_id, priceType.price_type_id),
        [tierPriceMap],
    );

    const validation = React.useMemo(() => {
        let validCount = 0;
        const invalidKeys = new Set<string>();

        for (const [key, raw] of draftPrices) {
            const result = parsePriceInput(raw);
            if (result.error) invalidKeys.add(key);
            if (result.value !== null) validCount += 1;
        }

        return { validCount, invalidKeys };
    }, [draftPrices]);

    const setDraftPrice = React.useCallback(
        (product: api.ProductSearchRow, priceTypeId: number, value: string) => {
            setDraftPrices((prev) => {
                const next = new Map(prev);
                const keysToUpdate = [cellKey(product.product_id, priceTypeId)];

                if (applyParentPriceToChildren && !isChildVariant(product)) {
                    const groupId = Number(groupIdFor(product));
                    for (const candidate of products) {
                        if (candidate.product_id === product.product_id || !isChildVariant(candidate)) continue;
                        if (Number(groupIdFor(candidate)) === groupId) {
                            keysToUpdate.push(cellKey(candidate.product_id, priceTypeId));
                        }
                    }
                }

                for (const key of keysToUpdate) {
                    if (value.trim()) next.set(key, value);
                    else next.delete(key);
                }

                return next;
            });
            setErrors((prev) => ({ ...prev, lines: undefined }));
        },
        [applyParentPriceToChildren, products],
    );

    const buildLines = React.useCallback((): CreatePriceChangeBatchPayload["lines"] => {
        const lines: CreatePriceChangeBatchPayload["lines"] = [];

        for (const [key, raw] of draftPrices) {
            const [productIdText, priceTypeIdText] = key.split(":");
            const productId = Number(productIdText);
            const priceTypeId = Number(priceTypeIdText);
            const product = productCatalog.get(productId);
            const priceType = priceTypesById.get(priceTypeId);
            const parsed = parsePriceInput(raw);

            if (!product || !priceType || parsed.value === null || parsed.error) continue;

            lines.push({
                product_id: product.product_id,
                price_type_id: priceType.price_type_id,
                current_price: currentPriceFor(product, priceType),
                proposed_price: parsed.value,
            });
        }

        return lines;
    }, [currentPriceFor, draftPrices, priceTypesById, productCatalog]);

    const gridNav = useEditableGridNavigation({
        rowCount: products.length,
        colCount: priceTypes.length,
        disabled: saving,
        onPasteSkipped: (count) => {
            toast.warning(
                `${count} pasted cell(s) skipped. Only non-negative numbers are accepted.`,
            );
        },
    });

    const canSubmit =
        !saving &&
        !loadingPriceTypes &&
        !loadingProducts &&
        Boolean(supplierId) &&
        Boolean(remarks.trim()) &&
        validation.validCount > 0 &&
        validation.invalidKeys.size === 0;

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
        if (validation.invalidKeys.size > 0) {
            nextErrors.lines = "Fix invalid proposed prices before submitting.";
        }

        const lines = buildLines();
        if (lines.length === 0) {
            nextErrors.lines = "Enter at least one proposed price.";
        }

        setErrors(nextErrors);
        if (Object.keys(nextErrors).length > 0) return;

        setSaving(true);
        try {
            const result = await api.createPriceChangeBatch({
                supplier_id: selectedSupplierId,
                reference_no: trimmedReferenceNo || undefined,
                remarks: trimmedRemarks,
                lines,
            });

            const created = Number(result.created ?? 0);
            if (created > 0) {
                toast.success(`Created price change batch with ${created} line(s).${summarizeCreated(result)}`);
                onCreated();
                onOpenChange(false);
            } else {
                toast.info(`No batch was created.${summarizeCreated(result)}`);
            }
        } catch (error: unknown) {
            toast.error(error instanceof Error ? error.message : "Failed to create price change batch");
        } finally {
            setSaving(false);
        }
    }, [
        buildLines,
        onCreated,
        onOpenChange,
        referenceNo,
        remarks,
        supplierId,
        validation.invalidKeys.size,
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
                            <SearchableSelect
                                options={supplierOptions}
                                value={supplierId}
                                onValueChange={handleSupplierChange}
                                placeholder="Select supplier"
                                disabled={suppliers.length === 0 || saving}
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
                            </div>
                            <div className="flex flex-col items-end gap-0.5 text-xs text-muted-foreground">
                                <div>{validation.validCount} edited price cell(s)</div>
                                <div>
                                    Tab/Enter to move · Paste from Excel · Edits kept across pages · Invalid
                                    values (text or negatives) are skipped
                                </div>
                            </div>
                        </div>

                        {supplierId ? (
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
                        ) : loadingPriceTypes || loadingProducts ? (
                            <div className="flex items-center justify-center gap-2 px-3 py-8 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Loading catalog
                            </div>
                        ) : priceTypes.length === 0 ? (
                            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                                No price types found.
                            </div>
                        ) : products.length === 0 ? (
                            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                                {catalogQuery
                                    ? "No products match your search."
                                    : "No linked products found for this supplier."}
                            </div>
                        ) : (
                            <>
                                <BatchPriceGrid
                                    products={products}
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
                                />
                                <div className="flex flex-col gap-3 border-t px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="text-sm text-muted-foreground">
                                        Showing{" "}
                                        <span className="font-medium text-foreground">{catalogStartIndex}</span> -{" "}
                                        <span className="font-medium text-foreground">{catalogEndIndex}</span>
                                        {catalogTotal > 0 ? (
                                            <>
                                                {" "}
                                                of <span className="font-medium text-foreground">{catalogTotal}</span>{" "}
                                                products
                                            </>
                                        ) : (
                                            " products"
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
