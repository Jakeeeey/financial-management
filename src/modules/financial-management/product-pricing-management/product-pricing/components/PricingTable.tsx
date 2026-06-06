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

const PTable = React.forwardRef<
    HTMLTableElement,
    React.TableHTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
    <table
        ref={ref}
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
    />
));
PTable.displayName = "PTable";

const PTableHeader = React.forwardRef<
    HTMLTableSectionElement,
    React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
    <thead ref={ref} className={cn("[&_tr]:border-b", className)} {...props} />
));
PTableHeader.displayName = "PTableHeader";

const PTableBody = React.forwardRef<
    HTMLTableSectionElement,
    React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
    <tbody
        ref={ref}
        className={cn("[&_tr:last-child]:border-0", className)}
        {...props}
    />
));
PTableBody.displayName = "PTableBody";

const PTableRow = React.forwardRef<
    HTMLTableRowElement,
    React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
    <tr
        ref={ref}
        className={cn("border-b transition-colors", className)}
        {...props}
    />
));
PTableRow.displayName = "PTableRow";

const PTableHead = React.forwardRef<
    HTMLTableCellElement,
    React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
    <th
        ref={ref}
        className={cn(
            "px-3 py-2 text-left align-middle font-medium text-muted-foreground",
            className
        )}
        {...props}
    />
));
PTableHead.displayName = "PTableHead";

const PTableCell = React.forwardRef<
    HTMLTableCellElement,
    React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
    <td
        ref={ref}
        className={cn("px-3 py-2 align-middle", className)}
        {...props}
    />
));
PTableCell.displayName = "PTableCell";

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
    return String(u.unit_shortcut ?? u.unit_name ?? "—").trim() || "—";
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

function tierStyle(tierIndex: number) {
    return TIER_STYLES[tierIndex] ?? TIER_STYLES[0];
}

function isTierName(value: string): value is ProductTierKey {
    return ["A", "B", "C", "D", "E", "LIST"].includes(value);
}

function sortPriceTypes(priceTypes: PriceType[]): PriceType[] {
    return [...priceTypes].sort((a, b) => {
        const aSort = Number(a.sort ?? Number.MAX_SAFE_INTEGER);
        const bSort = Number(b.sort ?? Number.MAX_SAFE_INTEGER);
        return aSort - bSort || String(a.price_type_name ?? "").localeCompare(String(b.price_type_name ?? ""));
    });
}

function toNum(v: unknown, fallback: number) {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : fallback;
}

function clamp(n: number, min: number, max: number) {
    return Math.max(min, Math.min(max, n));
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

const LEFT_TABLE_WIDTH = 420;
const PRICE_COL_WIDTH = 120;

const HEAD_ROW_H = 36;
const SUBHEAD_ROW_H = 30;
const BODY_ROW_H = 68;

function LoadingLeftBody({ rowCount }: { rowCount: number }) {
    return (
        <>
            {Array.from({ length: rowCount }).map((_, i) => (
                <PTableRow key={`lsk-${i}`} className="hover:bg-transparent">
                    <PTableCell className="h-[68px] w-[420px]">
                        <Skeleton className="mb-1.5 h-4 w-[260px]" />
                        <Skeleton className="h-3 w-[160px]" />
                    </PTableCell>
                </PTableRow>
            ))}
        </>
    );
}

function LoadingRightBody({ rowCount, priceCols }: { rowCount: number; priceCols: number }) {
    return (
        <>
            {Array.from({ length: rowCount }).map((_, i) => (
                <PTableRow key={`rsk-${i}`} className="hover:bg-transparent">
                    {Array.from({ length: priceCols }).map((__, j) => (
                        <PTableCell key={`rskc-${i}-${j}`} className="h-[68px] border-l align-top">
                            <Skeleton className="h-7 w-full rounded-md" />
                            <Skeleton className="mt-1.5 h-3 w-[56px]" />
                        </PTableCell>
                    ))}
                </PTableRow>
            ))}
        </>
    );
}

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

function ProductMetaPills({ row, display }: { row: MatrixRow; display: NonNullable<MatrixRow["display"]> }) {
    return (
        <div className="flex flex-wrap items-center gap-1 text-[10px] leading-none text-muted-foreground/80">
            <span className="max-w-[130px] truncate rounded bg-muted/50 px-1.5 py-1">{row.brand_name ?? "No brand"}</span>
            <span className="max-w-[130px] truncate rounded bg-muted/50 px-1.5 py-1">{row.category_name ?? "No category"}</span>
            <span className="max-w-[120px] truncate rounded bg-muted/50 px-1.5 py-1">Code: {display.product_code ?? "—"}</span>
            <span className="max-w-[150px] truncate rounded bg-muted/50 px-1.5 py-1">Barcode: {display.barcode ?? "—"}</span>
        </div>
    );
}

function CardPriceCell(props: {
    matrix: PricingMatrixLike;
    row: MatrixRow;
    tier: ProductTierKey;
    tierIndex: number;
    unit: Unit | null;
}) {
    const { matrix, row, tier, tierIndex, unit } = props;
    const st = tierStyle(tierIndex);
    const tierText = tier === "LIST" ? "List" : `Price ${tier}`;
    const unitText = unit ? unitLabel(unit) : "UOM";
    const uomId = unit ? Number(unit.unit_id) : 0;
    const variant = unit ? row.variantsByUnitId?.[String(uomId)] : undefined;

    if (!unit || !variant) {
        return (
            <div className={cn("rounded-md border p-2 text-xs text-muted-foreground", st.border, st.cell)}>
                <div className="mb-1 truncate font-medium text-foreground/70">{tierText} / {unitText}</div>
                <div className="flex h-7 items-center">—</div>
            </div>
        );
    }

    const variantProductId = Number(variant.product.product_id);
    if (!Number.isFinite(variantProductId) || variantProductId <= 0) {
        return (
            <div className={cn("rounded-md border p-2 text-xs text-muted-foreground", st.border, st.cell)}>
                <div className="mb-1 truncate font-medium text-foreground/70">{tierText} / {unitText}</div>
                <div className="flex h-7 items-center">—</div>
            </div>
        );
    }

    const base = toNullableNumber(variant.tiers?.[tier]);
    const val = matrix.getCellValue(variantProductId, tier, base);
    const pending = matrix.getPendingValue(variantProductId, tier);
    const dirty = matrix.isDirty(variantProductId, tier);
    const err = toErrorString(matrix.getError(variantProductId, tier));

    return (
        <div className={cn("rounded-md border bg-background p-2", st.border)}>
            <div className="mb-1 truncate text-[11px] font-semibold text-foreground/75">{tierText} / {unitText}</div>
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

function PricingCards(props: {
    matrix: PricingMatrixLike;
    rows: MatrixRow[];
    tiers: ProductTierKey[];
    usedUnits: Unit[];
    loading: boolean;
    totalGroups: number;
}) {
    const { matrix, rows, tiers, usedUnits, loading, totalGroups } = props;

    if (loading && rows.length === 0) {
        return <LoadingCardBody rowCount={6} />;
    }

    if (!loading && totalGroups === 0) {
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
                                {display.product_name ?? "—"}
                            </div>
                            <ProductMetaPills row={row} display={display} />
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                            {tiers.flatMap((tier, tierIndex) => {
                                if (usedUnits.length > 0) {
                                    return usedUnits.map((unit) => (
                                        <CardPriceCell
                                            key={`${groupKey}-${tier}-${unit.unit_id}`}
                                            matrix={matrix}
                                            row={row}
                                            tier={tier}
                                            tierIndex={tierIndex}
                                            unit={unit}
                                        />
                                    ));
                                }

                                return [
                                    <CardPriceCell
                                        key={`${groupKey}-${tier}-none`}
                                        matrix={matrix}
                                        row={row}
                                        tier={tier}
                                        tierIndex={tierIndex}
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
    const uomCount = Math.max(1, usedUnits.length);

    const tiers = React.useMemo(() => {
        if (matrix.filters.price_view === "ALL") {
            return [...matrix.TIERS];
        }

        if (matrix.filters.price_view === "LIST") {
            return ["LIST"] as ProductTierKey[];
        }

        const selectedIds = matrix.filters.price_type_ids;
        const sortedPriceTypes = sortPriceTypes(matrix.priceTypes);
        const selectedPriceType =
            sortedPriceTypes.find((pt) => selectedIds.includes(pt.price_type_id)) ??
            sortedPriceTypes[0] ??
            null;
        const selectedName = String(selectedPriceType?.price_type_name ?? "");

        if (isTierName(selectedName) && selectedName !== "LIST" && matrix.TIERS.includes(selectedName)) {
            return [selectedName];
        }

        return matrix.TIERS.filter((tier) => tier !== "LIST").slice(0, 1);
    }, [matrix.TIERS, matrix.filters.price_view, matrix.filters.price_type_ids, matrix.priceTypes]);

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

    const headCellBase = "whitespace-nowrap border-b text-[12px] font-semibold text-foreground/80 p-0";
    const subHeadCellBase = "whitespace-nowrap border-b text-[11px] font-medium text-foreground/70 p-0";

    const [viewMode, setViewMode] = React.useState<ViewMode>("table");
    const manualViewModeRef = React.useRef(false);
    const [hoverKey, setHoverKey] = React.useState<string | null>(null);

    const priceScrollRef = React.useRef<HTMLDivElement | null>(null);
    const trackRef = React.useRef<HTMLDivElement | null>(null);

    const [metrics, setMetrics] = React.useState({
        scrollLeft: 0,
        scrollWidth: 1,
        clientWidth: 1,
        trackWidth: 1,
    });

    const readMetrics = React.useCallback(() => {
        const sc = priceScrollRef.current;
        const tr = trackRef.current;
        if (!sc) return;

        setMetrics({
            scrollLeft: sc.scrollLeft,
            scrollWidth: Math.max(1, sc.scrollWidth),
            clientWidth: Math.max(1, sc.clientWidth),
            trackWidth: Math.max(1, tr?.clientWidth ?? sc.clientWidth),
        });
    }, []);

    React.useEffect(() => {
        const query = window.matchMedia("(max-width: 767px)");
        const syncViewMode = () => {
            if (!manualViewModeRef.current) {
                setViewMode(query.matches ? "cards" : "table");
            }
        };

        syncViewMode();
        query.addEventListener("change", syncViewMode);

        return () => {
            query.removeEventListener("change", syncViewMode);
        };
    }, []);

    const setManualViewMode = React.useCallback((next: ViewMode) => {
        manualViewModeRef.current = true;
        setViewMode(next);
    }, []);

    React.useEffect(() => {
        readMetrics();

        const sc = priceScrollRef.current;
        const tr = trackRef.current;
        if (!sc) return;

        const onResize = () => readMetrics();
        window.addEventListener("resize", onResize);

        const ro = new ResizeObserver(() => readMetrics());
        ro.observe(sc);
        if (tr) ro.observe(tr);

        return () => {
            window.removeEventListener("resize", onResize);
            ro.disconnect();
        };
    }, [readMetrics, tiers.length, usedUnits.length, rows.length]);

    const onPriceScroll = React.useCallback(() => {
        readMetrics();
    }, [readMetrics]);

    const maxScrollLeft = Math.max(0, metrics.scrollWidth - metrics.clientWidth);
    const thumbWidth = Math.max(
        36,
        Math.floor((metrics.clientWidth / metrics.scrollWidth) * metrics.trackWidth)
    );
    const thumbMaxX = Math.max(0, metrics.trackWidth - thumbWidth);
    const thumbX =
        maxScrollLeft <= 0 ? 0 : Math.floor((metrics.scrollLeft / maxScrollLeft) * thumbMaxX);

    const setScrollLeft = React.useCallback(
        (next: number) => {
            const sc = priceScrollRef.current;
            if (!sc) return;
            sc.scrollLeft = clamp(next, 0, maxScrollLeft);
        },
        [maxScrollLeft]
    );

    const onTrackClick = React.useCallback(
        (e: React.MouseEvent<HTMLDivElement>) => {
            const tr = trackRef.current;
            if (!tr) return;

            const rect = tr.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const targetThumbX = clamp(x - thumbWidth / 2, 0, thumbMaxX);
            const ratio = thumbMaxX <= 0 ? 0 : targetThumbX / thumbMaxX;
            setScrollLeft(ratio * maxScrollLeft);
        },
        [maxScrollLeft, setScrollLeft, thumbMaxX, thumbWidth]
    );

    const draggingRef = React.useRef<{ startX: number; startScrollLeft: number }>({
        startX: 0,
        startScrollLeft: 0,
    });

    const onThumbMouseDown = React.useCallback(
        (e: React.MouseEvent<HTMLDivElement>) => {
            e.preventDefault();
            e.stopPropagation();

            draggingRef.current = { startX: e.clientX, startScrollLeft: metrics.scrollLeft };

            const onMove = (ev: MouseEvent) => {
                const dx = ev.clientX - draggingRef.current.startX;
                const ratio = thumbMaxX <= 0 ? 0 : dx / thumbMaxX;
                setScrollLeft(draggingRef.current.startScrollLeft + ratio * maxScrollLeft);
            };

            const onUp = () => {
                window.removeEventListener("mousemove", onMove);
                window.removeEventListener("mouseup", onUp);
            };

            window.addEventListener("mousemove", onMove);
            window.addEventListener("mouseup", onUp);
        },
        [maxScrollLeft, metrics.scrollLeft, setScrollLeft, thumbMaxX]
    );

    const priceCols = tiers.length * uomCount;
    const priceViewLabel =
        matrix.filters.price_view === "ALL"
            ? "All Prices"
            : tiers[0] === "LIST"
                ? "List Price"
                : `Price ${tiers[0] ?? ""}`;
    const priceViewHelp =
        matrix.filters.price_view === "ALL"
            ? "Showing every price type. Use the horizontal bar if more columns are available."
            : `Focused editing for ${priceViewLabel}. Switch to All Prices only when you need the full matrix.`;

    return (
        <div className="relative z-0 flex min-h-0 min-w-0 flex-col rounded-2xl border bg-background shadow-sm">
            <style>{`
        .pmx-table { border-collapse: separate !important; border-spacing: 0 !important; }
        .pmx-price-x::-webkit-scrollbar { height: 0px; }
        .pmx-price-x::-webkit-scrollbar-thumb { background: transparent; }
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
            <div className="relative min-h-0 flex-1">
                <div className="flex min-w-0">
                    {/* LEFT */}
                    <div className="shrink-0 border-r bg-background" style={{ width: LEFT_TABLE_WIDTH }}>
                        <div className="sticky top-0 z-40 overflow-hidden bg-background border-b shadow-md">
                            <PTable className="pmx-table table-fixed" style={{ width: LEFT_TABLE_WIDTH }}>
                                <colgroup>
                                    <col style={{ width: LEFT_TABLE_WIDTH }} />
                                </colgroup>

                                <PTableHeader>
                                    <PTableRow style={{ height: HEAD_ROW_H }}>
                                        <PTableHead className={cn(headCellBase, "border-r")}>
                                            <div style={{ height: HEAD_ROW_H }} className="flex items-center px-3">Product</div>
                                        </PTableHead>
                                    </PTableRow>

                                    <PTableRow style={{ height: SUBHEAD_ROW_H }}>
                                        <PTableHead className={cn(subHeadCellBase, "border-r")}>
                                            <div style={{ height: SUBHEAD_ROW_H }} className="flex items-center px-3">
                                                Brand / Category / Code / Barcode
                                            </div>
                                        </PTableHead>
                                    </PTableRow>
                                </PTableHeader>
                            </PTable>
                        </div>

                        <PTable className="pmx-table table-fixed" style={{ width: LEFT_TABLE_WIDTH }}>
                            <colgroup>
                                <col style={{ width: LEFT_TABLE_WIDTH }} />
                            </colgroup>

                            <PTableBody className={cn(loading && rows.length > 0 && "pmx-loading-row")}>
                                {loading && rows.length === 0 ? <LoadingLeftBody rowCount={10} /> : null}

                                {rows.map((r) => {
                                        const display = r.display ?? {};
                                        const groupKey = String(r.group_id);
                                        const hovered = hoverKey === groupKey;

                                        return (
                                            <PTableRow
                                                key={`L-${groupKey}`}
                                                className={cn(hovered ? "bg-muted/30" : "hover:bg-muted/30")}
                                                style={{ height: BODY_ROW_H }}
                                                onMouseEnter={() => setHoverKey(groupKey)}
                                                onMouseLeave={() => setHoverKey(null)}
                                            >
                                                <PTableCell className="hidden p-0 border-b overflow-hidden" style={{ height: BODY_ROW_H }}>
                                                    <div style={{ height: BODY_ROW_H }} className="flex items-center px-3 truncate text-[13px] text-muted-foreground">
                                                        {r.brand_name ?? "—"}
                                                    </div>
                                                </PTableCell>
                                                <PTableCell className="hidden p-0 border-b overflow-hidden" style={{ height: BODY_ROW_H }}>
                                                    <div style={{ height: BODY_ROW_H }} className="flex items-center px-3 truncate text-[13px] text-muted-foreground">
                                                        {r.category_name ?? "—"}
                                                    </div>
                                                </PTableCell>
                                                <PTableCell className="p-0 border-b" style={{ width: LEFT_TABLE_WIDTH, height: BODY_ROW_H }}>
                                                    <div style={{ height: BODY_ROW_H }} className="flex flex-col justify-center gap-1 px-3">
                                                        <span className="line-clamp-2 text-[13px] font-semibold leading-tight text-foreground/90">
                                                            {display.product_name ?? "—"}
                                                        </span>
                                                        <div className="flex flex-wrap items-center gap-1 text-[10px] leading-none text-muted-foreground/80">
                                                            <span className="max-w-[110px] truncate rounded bg-muted/40 px-1.5 py-0.5">
                                                                {r.brand_name ?? "No brand"}
                                                            </span>
                                                            <span className="max-w-[110px] truncate rounded bg-muted/40 px-1.5 py-0.5">
                                                                {r.category_name ?? "No category"}
                                                            </span>
                                                            <span className="flex max-w-[96px] items-center gap-1 rounded bg-muted/40 px-1.5 py-0.5 border border-muted-foreground/10 truncate">
                                                                Code: <span className="font-medium text-foreground/80">{display.product_code ?? "—"}</span>
                                                            </span>
                                                            <span className="flex max-w-[128px] items-center gap-1 rounded bg-muted/40 px-1.5 py-0.5 border border-muted-foreground/10 truncate">
                                                                Barcode: <span className="font-medium text-foreground/80">{display.barcode ?? "—"}</span>
                                                            </span>
                                                        </div>
                                                    </div>
                                                </PTableCell>
                                            </PTableRow>
                                        );
                                    })}

                                {!loading && totalGroups === 0 ? (
                                    <PTableRow>
                                        <PTableCell className="py-10 text-center text-muted-foreground">
                                            No products found.
                                        </PTableCell>
                                    </PTableRow>
                                ) : null}
                            </PTableBody>
                        </PTable>
                    </div>

                    {/* RIGHT */}
                    <div className="min-w-0 flex-1">
                        <div className="sticky top-0 z-40 bg-background border-b shadow-md">
                            <div className="overflow-hidden border-b">
                                <div
                                    className="w-max"
                                    style={{ transform: `translateX(${-metrics.scrollLeft}px)` }}
                                >
                                    <PTable className="pmx-table w-max table-fixed border-t-0">
                                        <colgroup>
                                            {tiers.map((_, ti) =>
                                                Array.from({ length: uomCount }).map((__, ui) => (
                                                    <col key={`hcol-${ti}-${ui}`} style={{ width: PRICE_COL_WIDTH }} />
                                                ))
                                            )}
                                        </colgroup>

                                        <PTableHeader>
                                            <PTableRow style={{ height: HEAD_ROW_H }}>
                                                {tiers.map((t, ti) => {
                                                    const st = tierStyle(ti);
                                                    return (
                                                        <PTableHead
                                                            key={`htier-${String(t)}`}
                                                            className={cn(
                                                                headCellBase,
                                                                st.head,
                                                                st.border,
                                                                "text-center uppercase tracking-wide",
                                                                ti === 0 ? "" : "border-l"
                                                            )}
                                                            colSpan={uomCount}
                                                        >
                                                            <div style={{ height: HEAD_ROW_H }} className="flex items-center justify-center">
                                                                {t === "LIST" ? "List Price" : t}
                                                            </div>
                                                        </PTableHead>
                                                    );
                                                })}
                                            </PTableRow>

                                            <PTableRow style={{ height: SUBHEAD_ROW_H }}>
                                                {tiers.map((t, ti) => {
                                                    const st = tierStyle(ti);

                                                    if (!usedUnits.length) {
                                                        return (
                                                            <PTableHead
                                                                key={`huom-${String(t)}-none`}
                                                                className={cn(
                                                                    subHeadCellBase,
                                                                    st.head,
                                                                    st.border,
                                                                    "text-center",
                                                                    ti === 0 ? "" : "border-l"
                                                                )}
                                                            >
                                                                <div style={{ height: SUBHEAD_ROW_H }} className="flex items-center justify-center">UOM</div>
                                                            </PTableHead>
                                                        );
                                                    }

                                                    return usedUnits.map((u, uIndex) => (
                                                        <PTableHead
                                                            key={`huom-${String(t)}-${String(u.unit_id)}`}
                                                            className={cn(
                                                                subHeadCellBase,
                                                                st.head,
                                                                st.border,
                                                                "text-center",
                                                                ti === 0 && uIndex === 0 ? "" : "border-l"
                                                            )}
                                                        >
                                                            <div style={{ height: SUBHEAD_ROW_H }} className="flex items-center justify-center">{unitLabel(u)}</div>
                                                        </PTableHead>
                                                    ));
                                                })}
                                            </PTableRow>
                                        </PTableHeader>
                                    </PTable>
                                </div>
                            </div>
                        </div>

                        <div
                            ref={priceScrollRef}
                            onScroll={onPriceScroll}
                            className="pmx-price-x relative overflow-x-auto overflow-y-hidden"
                        >
                            <div className="w-max min-w-full">
                                <PTable className="pmx-table w-max table-fixed">
                                    <colgroup>
                                        {tiers.map((_, ti) =>
                                            Array.from({ length: uomCount }).map((__, ui) => (
                                                <col key={`bcol-${ti}-${ui}`} style={{ width: PRICE_COL_WIDTH }} />
                                            ))
                                        )}
                                    </colgroup>

                                    <PTableBody className={cn(loading && rows.length > 0 && "pmx-loading-row")}>
                                        {loading && rows.length === 0 ? <LoadingRightBody rowCount={10} priceCols={priceCols} /> : null}

                                        {rows.map((r) => {
                                                const groupKey = String(r.group_id);
                                                const hovered = hoverKey === groupKey;

                                                return (
                                                    <PTableRow
                                                        key={`R-${groupKey}`}
                                                        className={cn(hovered ? "bg-muted/30" : "hover:bg-muted/30")}
                                                        style={{ height: BODY_ROW_H }}
                                                        onMouseEnter={() => setHoverKey(groupKey)}
                                                        onMouseLeave={() => setHoverKey(null)}
                                                    >
                                                        {tiers.map((tier, ti) => {
                                                            const st = tierStyle(ti);

                                                            if (!usedUnits.length) {
                                                                return (
                                                                    <PTableCell
                                                                        key={`${groupKey}-${String(tier)}-none`}
                                                                        className={cn("p-0 text-center border-b text-muted-foreground", st.cell, st.border, ti === 0 ? "" : "border-l")}
                                                                        style={{ height: BODY_ROW_H, width: PRICE_COL_WIDTH }}
                                                                    >
                                                                        <div style={{ height: BODY_ROW_H }} className="flex items-center justify-center">—</div>
                                                                    </PTableCell>
                                                                );
                                                            }

                                                            return usedUnits.map((u, uIndex) => {
                                                                const uomId = Number(u.unit_id);
                                                                const byUnit = r.variantsByUnitId ?? {};
                                                                const variant = byUnit[String(uomId)];
                                                                const borderL = ti === 0 && uIndex === 0 ? "" : "border-l";

                                                                if (!variant) {
                                                                    return (
                                                                        <PTableCell
                                                                            key={`${groupKey}-${String(tier)}-${String(uomId)}-na`}
                                                                            className={cn("p-0 text-center border-b text-muted-foreground", st.cell, st.border, borderL)}
                                                                            style={{ height: BODY_ROW_H, width: PRICE_COL_WIDTH }}
                                                                        >
                                                                            <div style={{ height: BODY_ROW_H }} className="flex items-center justify-center">—</div>
                                                                        </PTableCell>
                                                                    );
                                                                }

                                                                const variantProductId = Number(variant.product.product_id);
                                                                if (!Number.isFinite(variantProductId) || variantProductId <= 0) {
                                                                    return (
                                                                        <PTableCell
                                                                            key={`${groupKey}-${String(tier)}-${String(uomId)}-bad`}
                                                                            className={cn("p-0 text-center border-b text-muted-foreground", st.cell, st.border, borderL)}
                                                                            style={{ height: BODY_ROW_H, width: PRICE_COL_WIDTH }}
                                                                        >
                                                                            <div style={{ height: BODY_ROW_H }} className="flex items-center justify-center">—</div>
                                                                        </PTableCell>
                                                                    );
                                                                }

                                                                const base = toNullableNumber(variant.tiers?.[tier]);
                                                                const val = matrix.getCellValue(variantProductId, tier, base);
                                                                const pending = matrix.getPendingValue(variantProductId, tier);
                                                                const dirty = matrix.isDirty(variantProductId, tier);
                                                                const err = toErrorString(matrix.getError(variantProductId, tier));

                                                                return (
                                                                    <PTableCell
                                                                        key={`${groupKey}-${String(tier)}-${String(uomId)}`}
                                                                        className={cn("p-0 border-b", st.cell, st.border, borderL)}
                                                                        style={{ height: BODY_ROW_H, width: PRICE_COL_WIDTH }}
                                                                    >
                                                                        <div style={{ height: BODY_ROW_H }} className="flex items-center justify-center px-2">
                                                                            <div className="w-full">
                                                                                <PriceCell
                                                                                    value={val}
                                                                                    pendingValue={pending}
                                                                                    dirty={dirty}
                                                                                    error={err}
                                                                                    onChange={(raw) => matrix.setCell(variantProductId, tier, raw)}
                                                                                />
                                                                            </div>
                                                                        </div>
                                                                    </PTableCell>
                                                                );
                                                            });
                                                        })}
                                                    </PTableRow>
                                                );
                                            })}
                                    </PTableBody>
                                </PTable>
                            </div>
                        </div>

                        {maxScrollLeft > 0 ? (
                            <div className="border-t bg-background/60 px-3 py-2">
                                <div
                                    ref={trackRef}
                                    onMouseDown={onTrackClick}
                                    className="relative h-3 w-full rounded-full bg-muted/70 ring-1 ring-border/60"
                                >
                                    <div
                                        role="slider"
                                        aria-label="Horizontal scroll"
                                        aria-valuemin={0}
                                        aria-valuemax={maxScrollLeft}
                                        aria-valuenow={metrics.scrollLeft}
                                        tabIndex={0}
                                        onMouseDown={onThumbMouseDown}
                                        className={cn(
                                            "absolute top-0 h-3 rounded-full",
                                            "bg-foreground/30 hover:bg-foreground/40 active:bg-foreground/50",
                                            "cursor-grab active:cursor-grabbing"
                                        )}
                                        style={{ width: `${thumbWidth}px`, transform: `translateX(${thumbX}px)` }}
                                    />
                                </div>
                            </div>
                        ) : null}
                    </div>
                </div>
            </div>
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
                                <span className="font-medium text-foreground">{totalGroups === 0 ? 0 : startIndex + 1}</span> –{" "}
                                <span className="font-medium text-foreground">{endIndex}</span> of{" "}
                                <span className="font-medium text-foreground">{totalGroups}</span> groups
                            </span>
                            {totalVariants > 0 ? (
                                <>
                                    <span className="hidden sm:inline">•</span>
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
