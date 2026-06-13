// src/modules/supply-chain-management/product-pricing-management/product-pricing/components/PricingTable.tsx
"use client";

import * as React from "react";
import type { PriceType, PricingFilters, ProductTierKey, Unit } from "../types";

import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, LayoutGrid, Table2 } from "lucide-react";

import PriceCell from "./PriceCell";
import { isListTierKey, resolveVisibleTierKeys, tierLabelForTierKey } from "../utils/pivot";

type VariantProduct = {
    product_id: number | string | null | undefined;
};

type MatrixVariant = {
    product: VariantProduct;
    tiers?: Partial<Record<ProductTierKey, unknown>>;
};

type MatrixRow = {
    group_id: number | string;
    display?: {
        product_code?: string | null;
        barcode?: string | null;
        product_name?: string | null;
    };
    category_name?: string | null;
    brand_name?: string | null;
    variantsByUnitId?: Record<string, MatrixVariant>;
};

type MatrixMeta = {
    page?: number | string | null;
    pageSize?: number | string | null;
    total?: number | string | null;
    totalVariants?: number | string | null;
    totalPages?: number | string | null;
};

type PricingMatrixLike = {
    TIERS: ProductTierKey[];
    usedUnits?: Unit[];
    rows?: MatrixRow[];
    meta?: MatrixMeta;

    loading?: boolean;
    error?: string | null;

    page?: number;
    pageSize?: number;

    setPage: (page: number) => void;
    setPageSize: (pageSize: number) => void;

    getCellValue: (productId: number, tier: ProductTierKey, base: number | null) => number | string | null;
    getPendingValue: (productId: number, tier: ProductTierKey) => number | null;
    isDirty: (productId: number, tier: ProductTierKey) => boolean;
    getError: (productId: number, tier: ProductTierKey) => string | null | undefined;
    setCell: (productId: number, tier: ProductTierKey, raw: unknown) => void;
    priceTypes: PriceType[];
    filters: PricingFilters;
};
type Props = {
    matrix: PricingMatrixLike;
};

type ViewMode = "table" | "cards";

function unitLabel(u: Unit) {
    return String(u.unit_shortcut ?? u.unit_name ?? "-").trim() || "-";
}

const TIER_STYLES = [
    { head: "bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200", cell: "bg-slate-50/50 hover:bg-slate-100/80 dark:bg-slate-950/20", border: "border-slate-200 dark:border-slate-800" }, // LIST
    { head: "bg-indigo-50 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200", cell: "bg-indigo-50/30 hover:bg-indigo-100/50 dark:bg-indigo-950/20", border: "border-indigo-100 dark:border-indigo-900" }, // A
    { head: "bg-sky-50 text-sky-800 dark:bg-sky-950 dark:text-sky-200", cell: "bg-sky-50/30 hover:bg-sky-100/50 dark:bg-sky-950/20", border: "border-sky-100 dark:border-sky-900" },
    { head: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200", cell: "bg-emerald-50/30 hover:bg-emerald-100/50 dark:bg-emerald-950/20", border: "border-emerald-100 dark:border-emerald-900" },
    { head: "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200", cell: "bg-amber-50/30 hover:bg-amber-100/50 dark:bg-amber-950/20", border: "border-amber-100 dark:border-amber-900" },
    { head: "bg-rose-50 text-rose-800 dark:bg-rose-950 dark:text-rose-200", cell: "bg-rose-50/30 hover:bg-rose-100/50 dark:bg-rose-950/20", border: "border-rose-100 dark:border-rose-900" },
    { head: "bg-fuchsia-50 text-fuchsia-800 dark:bg-fuchsia-950 dark:text-fuchsia-200", cell: "bg-fuchsia-50/30 hover:bg-fuchsia-100/50 dark:bg-fuchsia-950/20", border: "border-fuchsia-100 dark:border-fuchsia-900" },
] as const;

function tierStyleFor(tier: ProductTierKey, tiers: ProductTierKey[]) {
    const index = tiers.indexOf(tier);
    return TIER_STYLES[index >= 0 ? index % TIER_STYLES.length : 0];
}

function tierHeaderLabel(tier: ProductTierKey, priceTypes: PriceType[]) {
    return tierLabelForTierKey(tier, priceTypes);
}

function toNum(v: unknown, fallback: number) {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : fallback;
}

function toNullableNumber(v: unknown): number | null {
    if (v === null || v === undefined) return null;
    if (typeof v === "number") return Number.isFinite(v) ? v : null;
    if (typeof v === "string") {
        const s = v.trim();
        if (!s) return null;
        const n = Number(s);
        return Number.isFinite(n) ? n : null;
    }
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}

function toErrorString(err: unknown): string | null {
    if (err === null || err === undefined) return null;
    if (typeof err === "string") return err.trim() ? err : null;
    if (err instanceof Error) return err.message || "Error";
    try {
        const s = String(err);
        return s && s !== "[object Object]" ? s : "Invalid value";
    } catch {
        return "Invalid value";
    }
}

const VIEW_MODE_STORAGE_KEY = "product-pricing:view-mode";

function LoadingCardBody({ rowCount }: { rowCount: number }) {
    return (
        <div className="grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: rowCount }).map((_, i) => (
                <div key={`csk-${i}`} className="rounded-lg border bg-background p-3">
                    <Skeleton className="mb-2 h-4 w-3/4" />
                    <Skeleton className="mb-3 h-3 w-1/2" />
                    <div className="grid grid-cols-2 gap-2">
                        <Skeleton className="h-14 rounded-md" />
                        <Skeleton className="h-14 rounded-md" />
                    </div>
                </div>
            ))}
        </div>
    );
}

function LoadingProductBlockBody({ rowCount }: { rowCount: number }) {
    return (
        <div className="grid gap-3 p-3">
            {Array.from({ length: rowCount }).map((_, i) => (
                <div key={`pbsk-${i}`} className="rounded-lg border bg-background p-3">
                    <Skeleton className="mb-2 h-4 w-3/4" />
                    <Skeleton className="mb-3 h-3 w-1/2" />
                    <div className="space-y-1.5">
                        <Skeleton className="h-8 rounded-md" />
                        <Skeleton className="h-8 rounded-md" />
                        <Skeleton className="h-8 rounded-md" />
                    </div>
                </div>
            ))}
        </div>
    );
}

function ProductMetaPills({ row, display }: { row: MatrixRow; display: NonNullable<MatrixRow["display"]> }) {
    return (
        <div className="flex flex-wrap items-center gap-1 text-[10px] leading-none text-muted-foreground/80">
            <span className="max-w-[130px] truncate rounded bg-muted/50 px-1.5 py-1">{row.brand_name ?? "No brand"}</span>
            <span className="max-w-[130px] truncate rounded bg-muted/50 px-1.5 py-1">{row.category_name ?? "No category"}</span>
            <span className="max-w-[120px] truncate rounded bg-muted/50 px-1.5 py-1">Code: {display.product_code ?? "-"}</span>
            <span className="max-w-[150px] truncate rounded bg-muted/50 px-1.5 py-1">Barcode: {display.barcode ?? "-"}</span>
        </div>
    );
}

function CardPriceCell(props: {
    matrix: PricingMatrixLike;
    row: MatrixRow;
    tier: ProductTierKey;
    unit: Unit | null;
}) {
    const { matrix, row, tier, unit } = props;
    const st = tierStyleFor(tier, matrix.TIERS);
    const tierText = tierHeaderLabel(tier, matrix.priceTypes);
    const unitText = unit ? unitLabel(unit) : "UOM";
    const uomId = unit ? Number(unit.unit_id) : 0;
    const variant = unit ? row.variantsByUnitId?.[String(uomId)] : undefined;

    if (!unit || !variant) {
        return (
            <div className={cn("rounded-md border p-2 text-xs text-muted-foreground", st.border, st.cell)}>
                <div className="mb-1 truncate font-medium text-foreground/70">
                    {tierText} / {unitText}
                </div>
                <div className="flex h-7 items-center">-</div>
            </div>
        );
    }

    const variantProductId = Number(variant.product.product_id);
    if (!Number.isFinite(variantProductId) || variantProductId <= 0) {
        return (
            <div className={cn("rounded-md border p-2 text-xs text-muted-foreground", st.border, st.cell)}>
                <div className="mb-1 truncate font-medium text-foreground/70">
                    {tierText} / {unitText}
                </div>
                <div className="flex h-7 items-center">-</div>
            </div>
        );
    }

    const base = toNullableNumber(variant.tiers?.[tier]);
    const val = matrix.getCellValue(variantProductId, tier, base);
    const pending = matrix.getPendingValue(variantProductId, tier);
    const dirty = matrix.isDirty(variantProductId, tier);
    const err = toErrorString(matrix.getError(variantProductId, tier));

    return (
        <div className={cn("min-w-0 rounded-md border bg-background p-2", st.border)}>
            <div className="mb-1 truncate text-[11px] font-semibold text-foreground/75">
                {tierText} / {unitText}
            </div>
            <PriceCell
                value={val}
                pendingValue={pending}
                dirty={dirty}
                error={err}
                onChange={(raw) => matrix.setCell(variantProductId, tier, raw)}
            />
        </div>
    );
}

function ProductBlockPriceCell(props: {
    matrix: PricingMatrixLike;
    variant: MatrixVariant | undefined;
    tier: ProductTierKey;
}) {
    const { matrix, variant, tier } = props;

    if (!variant) {
        return (
            <div className="flex min-h-9 items-center justify-end text-xs text-muted-foreground">-</div>
        );
    }

    const variantProductId = Number(variant.product.product_id);
    if (!Number.isFinite(variantProductId) || variantProductId <= 0) {
        return (
            <div className="flex min-h-9 items-center justify-end text-xs text-muted-foreground">-</div>
        );
    }

    const base = toNullableNumber(variant.tiers?.[tier]);
    const val = matrix.getCellValue(variantProductId, tier, base);
    const pending = matrix.getPendingValue(variantProductId, tier);
    const dirty = matrix.isDirty(variantProductId, tier);
    const err = toErrorString(matrix.getError(variantProductId, tier));

    return (
        <div className="min-w-[128px]">
            <PriceCell
                value={val}
                pendingValue={pending}
                dirty={dirty}
                error={err}
                onChange={(raw) => matrix.setCell(variantProductId, tier, raw)}
            />
        </div>
    );
}

function ProductBlockPriceTable(props: {
    matrix: PricingMatrixLike;
    row: MatrixRow;
    tiers: ProductTierKey[];
    usedUnits: Unit[];
}) {
    const { matrix, row, tiers, usedUnits } = props;
    const variantsByUnitId = row.variantsByUnitId ?? {};
    const fallbackUnits = Object.keys(variantsByUnitId)
        .map((unitId) => ({
            unit_id: Number(unitId),
            unit_name: `Unit ${unitId}`,
            unit_shortcut: `U${unitId}`,
        }))
        .filter((unit) => Number.isFinite(unit.unit_id) && unit.unit_id > 0);
    const printableUnits = usedUnits.length > 0 ? usedUnits : fallbackUnits;

    if (printableUnits.length === 0) {
        return (
            <div className="rounded-md border bg-muted/20 px-3 py-4 text-center text-sm text-muted-foreground">
                No unit prices available for this product.
            </div>
        );
    }

    const tableMinWidth = Math.max(420, 136 * printableUnits.length + 150);

    return (
        <div className="overflow-x-auto rounded-md border">
            <table className="w-full border-collapse table-fixed text-xs" style={{ minWidth: tableMinWidth }}>
                <colgroup>
                    <col style={{ width: 150 }} />
                    {printableUnits.map((unit) => (
                        <col key={`col-${String(unit.unit_id)}`} style={{ width: 136 }} />
                    ))}
                </colgroup>
                <thead>
                    <tr className="border-b bg-muted/40">
                        <th className="px-3 py-2 text-left font-semibold text-foreground/80">Price Type</th>
                        {printableUnits.map((unit) => (
                            <th
                                key={`head-${String(unit.unit_id)}`}
                                className="border-l px-3 py-2 text-left font-semibold text-foreground/80"
                            >
                                {unitLabel(unit)}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {tiers.map((tier) => {
                        const st = tierStyleFor(tier, tiers);

                        return (
                            <tr key={`tier-${String(tier)}`} className={cn("border-b last:border-b-0", st.cell)}>
                                <th
                                    className={cn(
                                        "px-3 py-2 text-left align-middle text-xs font-semibold",
                                        st.head,
                                        st.border,
                                    )}
                                >
                                    <span className="block truncate">
                                        {tierHeaderLabel(tier, matrix.priceTypes)}
                                    </span>
                                </th>
                                {printableUnits.map((unit) => {
                                    const variant = variantsByUnitId[String(Number(unit.unit_id))];

                                    return (
                                        <td
                                            key={`${String(tier)}-${String(unit.unit_id)}`}
                                            className={cn("border-l px-2 py-2 align-top", st.border)}
                                        >
                                            <ProductBlockPriceCell
                                                matrix={matrix}
                                                variant={variant}
                                                tier={tier}
                                            />
                                        </td>
                                    );
                                })}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

function PricingProductBlocks(props: {
    matrix: PricingMatrixLike;
    rows: MatrixRow[];
    tiers: ProductTierKey[];
    usedUnits: Unit[];
    loading: boolean;
    totalGroups: number;
}) {
    const { matrix, rows, tiers, usedUnits, loading, totalGroups } = props;
    const hasLoadError = Boolean(matrix.error);

    if (loading && rows.length === 0) {
        return <LoadingProductBlockBody rowCount={6} />;
    }

    if (!loading && totalGroups === 0 && !hasLoadError) {
        return <div className="p-8 text-center text-sm text-muted-foreground">No products found.</div>;
    }

    return (
        <div className={cn("grid gap-3 p-3", loading && rows.length > 0 && "pmx-loading-row")}>
            {rows.map((row) => {
                const display = row.display ?? {};
                const groupKey = String(row.group_id);

                return (
                    <article key={`C-${groupKey}`} className="rounded-lg border bg-background p-3 shadow-sm">
                        <div className="space-y-1.5">
                            <div className="line-clamp-2 text-sm font-semibold leading-tight text-foreground">
                                {display.product_name ?? "-"}
                            </div>
                            <ProductMetaPills row={row} display={display} />
                        </div>

                        <div className="mt-3">
                            <ProductBlockPriceTable
                                matrix={matrix}
                                row={row}
                                tiers={tiers}
                                usedUnits={usedUnits}
                            />
                        </div>
                    </article>
                );
            })}
        </div>
    );
}

function PricingCards(props: {
    matrix: PricingMatrixLike;
    rows: MatrixRow[];
    tiers: ProductTierKey[];
    usedUnits: Unit[];
    loading: boolean;
    totalGroups: number;
}) {
    const { matrix, rows, tiers, usedUnits, loading, totalGroups } = props;
    const hasLoadError = Boolean(matrix.error);

    if (loading && rows.length === 0) {
        return <LoadingCardBody rowCount={6} />;
    }

    if (!loading && totalGroups === 0 && !hasLoadError) {
        return <div className="p-8 text-center text-sm text-muted-foreground">No products found.</div>;
    }

    return (
        <div className={cn("grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-3", loading && rows.length > 0 && "pmx-loading-row")}>
            {rows.map((row) => {
                const display = row.display ?? {};
                const groupKey = String(row.group_id);

                return (
                    <article key={`C-${groupKey}`} className="rounded-lg border bg-background p-3 shadow-sm">
                        <div className="space-y-1.5">
                            <div className="line-clamp-2 text-sm font-semibold leading-tight text-foreground">
                                {display.product_name ?? "-"}
                            </div>
                            <ProductMetaPills row={row} display={display} />
                        </div>

                        <div className="mt-3 grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3">
                            {tiers.flatMap((tier) => {
                                if (usedUnits.length > 0) {
                                    return usedUnits.map((unit) => (
                                        <CardPriceCell
                                            key={`${groupKey}-${String(tier)}-${String(unit.unit_id)}`}
                                            matrix={matrix}
                                            row={row}
                                            tier={tier}
                                            unit={unit}
                                        />
                                    ));
                                }

                                return [
                                    <CardPriceCell
                                        key={`${groupKey}-${String(tier)}-none`}
                                        matrix={matrix}
                                        row={row}
                                        tier={tier}
                                        unit={null}
                                    />,
                                ];
                            })}
                        </div>
                    </article>
                );
            })}
        </div>
    );
}

export default function PricingTable({ matrix }: Props) {
    const usedUnits: Unit[] = Array.isArray(matrix.usedUnits) ? matrix.usedUnits : [];

    const tiers = React.useMemo(
        (): ProductTierKey[] =>
            resolveVisibleTierKeys({
                priceView: matrix.filters.price_view,
                priceTypeIds: matrix.filters.price_type_ids,
                priceTypes: matrix.priceTypes,
                allTierKeys: matrix.TIERS,
            }),
        [matrix.TIERS, matrix.filters.price_view, matrix.filters.price_type_ids, matrix.priceTypes],
    );

    const rows: MatrixRow[] = Array.isArray(matrix.rows) ? matrix.rows : [];
    const meta: MatrixMeta = matrix.meta ?? {};
    const loading = Boolean(matrix.loading);

    const page = toNum(meta.page ?? matrix.page ?? 1, 1);
    const pageSize = toNum(meta.pageSize ?? matrix.pageSize ?? 50, 50);

    const totalGroups = toNum(meta.total ?? 0, 0);
    const totalVariants = toNum(meta.totalVariants ?? 0, 0);
    const totalPages =
        toNum(meta.totalPages ?? 0, 0) || (totalGroups > 0 ? Math.ceil(totalGroups / pageSize) : 1);

    const startIndex = totalGroups === 0 ? 0 : (page - 1) * pageSize;
    const endIndex = totalGroups === 0 ? 0 : Math.min(totalGroups, startIndex + rows.length);

    const canPrev = !loading && page > 1 && totalGroups > 0;
    const canNext = !loading && page < totalPages && totalGroups > 0;

    const [viewMode, setViewMode] = React.useState<ViewMode>("table");

    React.useEffect(() => {
        try {
            const saved = window.localStorage.getItem(VIEW_MODE_STORAGE_KEY);
            if (saved === "table" || saved === "cards") {
                setViewMode(saved);
            }
        } catch {
            setViewMode("table");
        }
    }, []);

    const setManualViewMode = React.useCallback((next: ViewMode) => {
        setViewMode(next);
        try {
            window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, next);
        } catch {
            // Ignore storage errors; the in-session view switch still works.
        }
    }, []);

    const focusedPriceTiers = tiers.filter((tier) => !isListTierKey(tier));
    const showsListCost = tiers.some(isListTierKey);
    const priceViewLabel =
        matrix.filters.price_view === "ALL"
            ? "All Prices"
            : matrix.filters.price_view === "LIST"
                ? "List Cost"
                : showsListCost && focusedPriceTiers.length > 0
                    ? `${tierLabelForTierKey(focusedPriceTiers[0], matrix.priceTypes)} + List Cost`
                    : isListTierKey(tiers[0] ?? "")
                        ? "List Cost"
                        : tierLabelForTierKey(tiers[0] ?? "", matrix.priceTypes);
    const priceViewHelp =
        matrix.filters.price_view === "ALL"
            ? "Showing every price type grouped by product."
            : matrix.filters.price_view === "LIST"
                ? "Focused editing for list cost. Switch to All Prices when you need the full matrix."
                : showsListCost && focusedPriceTiers.length > 0
                    ? `Edit ${tierLabelForTierKey(focusedPriceTiers[0], matrix.priceTypes)} with list cost visible alongside. Switch to All Prices only when you need every tier.`
                    : `Focused editing for ${priceViewLabel}. Switch to All Prices only when you need the full matrix.`;

    return (
        <div className="relative z-0 flex min-h-0 min-w-0 flex-col rounded-2xl border bg-background shadow-sm">
            <style>{`
        .pmx-loading-row { opacity: 0.5; pointer-events: none; transition: opacity 0.2s ease; }
      `}</style>

            {loading && rows.length > 0 && (
                <div className="absolute top-0 left-0 right-0 z-50 h-1 overflow-hidden">
                    <div className="h-full w-full bg-primary/20 animate-pulse">
                        <div className="h-full bg-primary animate-progress-fast" style={{ width: '30%' }} />
                    </div>
                </div>
            )}

            <div className="flex flex-col gap-2 border-b bg-muted/20 px-3 py-2 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                    <div className="text-sm font-semibold text-foreground">{priceViewLabel}</div>
                    <div className="text-xs text-muted-foreground">{priceViewHelp}</div>
                </div>
                <div className="inline-flex w-fit items-center rounded-md border bg-background p-1">
                    <Button
                        type="button"
                        variant={viewMode === "table" ? "secondary" : "ghost"}
                        size="sm"
                        className="h-8 gap-1.5 px-2"
                        onClick={() => setManualViewMode("table")}
                        title="Table view"
                    >
                        <Table2 className="h-4 w-4" />
                        <span>Table</span>
                    </Button>
                    <Button
                        type="button"
                        variant={viewMode === "cards" ? "secondary" : "ghost"}
                        size="sm"
                        className="h-8 gap-1.5 px-2"
                        onClick={() => setManualViewMode("cards")}
                        title="Card view"
                    >
                        <LayoutGrid className="h-4 w-4" />
                        <span>Cards</span>
                    </Button>
                </div>
            </div>

            {viewMode === "table" ? (
                <PricingProductBlocks
                    matrix={matrix}
                    rows={rows}
                    tiers={tiers}
                    usedUnits={usedUnits}
                    loading={loading}
                    totalGroups={totalGroups}
                />
            ) : (
                <PricingCards
                    matrix={matrix}
                    rows={rows}
                    tiers={tiers}
                    usedUnits={usedUnits}
                    loading={loading}
                    totalGroups={totalGroups}
                />
            )}

            <div className="flex flex-col gap-2 border-t bg-background/60 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {loading ? (
                        <>
                            <Skeleton className="h-4 w-[240px]" />
                            <Skeleton className="h-4 w-[140px]" />
                        </>
                    ) : (
                        <>
                            <span>
                                Showing{" "}
                                <span className="font-medium text-foreground">{totalGroups === 0 ? 0 : startIndex + 1}</span> -{" "}
                                <span className="font-medium text-foreground">{endIndex}</span> of{" "}
                                <span className="font-medium text-foreground">{totalGroups}</span> groups
                            </span>
                            {totalVariants > 0 ? (
                                <>
                                    <span className="hidden sm:inline">|</span>
                                    <span>
                                        <span className="font-medium text-foreground">{totalVariants}</span> variants
                                    </span>
                                </>
                            ) : null}
                        </>
                    )}

                    <div className="hidden sm:block h-4 w-px bg-border" />

                    <div className="flex items-center gap-2">
                        <span className="hidden sm:inline">Rows:</span>
                        <Select
                            value={String(pageSize)}
                            onValueChange={(v) => {
                                matrix.setPageSize(Number(v));
                                matrix.setPage(1);
                            }}
                            disabled={loading}
                        >
                            <SelectTrigger className="h-8 w-[110px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent align="end">
                                <SelectItem value="10">10 / page</SelectItem>
                                <SelectItem value="25">25 / page</SelectItem>
                                <SelectItem value="50">50 / page</SelectItem>
                                <SelectItem value="100">100 / page</SelectItem>
                                <SelectItem value="200">200 / page</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="flex items-center justify-between gap-2 sm:justify-end">
                    <div className="text-xs text-muted-foreground">
                        {loading ? (
                            <Skeleton className="h-4 w-[140px]" />
                        ) : (
                            <>
                                Page <span className="font-medium text-foreground">{page}</span> of{" "}
                                <span className="font-medium text-foreground">{Math.max(1, totalPages)}</span>
                            </>
                        )}
                    </div>

                    <div className="flex items-center gap-1">
                        <Button type="button" variant="outline" size="sm" className="h-8 px-2" onClick={() => matrix.setPage(1)} disabled={!canPrev} title="First page">
                            <ChevronsLeft className="h-4 w-4" />
                        </Button>
                        <Button type="button" variant="outline" size="sm" className="h-8 px-2" onClick={() => matrix.setPage(Math.max(1, page - 1))} disabled={!canPrev} title="Previous page">
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button type="button" variant="outline" size="sm" className="h-8 px-2" onClick={() => matrix.setPage(Math.min(Math.max(1, totalPages), page + 1))} disabled={!canNext} title="Next page">
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                        <Button type="button" variant="outline" size="sm" className="h-8 px-2" onClick={() => matrix.setPage(Math.max(1, totalPages))} disabled={!canNext} title="Last page">
                            <ChevronsRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
