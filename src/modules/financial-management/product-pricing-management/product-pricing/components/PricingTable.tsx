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
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

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
    isDirty: (productId: number, tier: ProductTierKey) => boolean;
    getError: (productId: number, tier: ProductTierKey) => string | null | undefined;
    setCell: (productId: number, tier: ProductTierKey, raw: unknown) => void;
    priceTypes: PriceType[];
    filters: PricingFilters;
};
type Props = {
    matrix: PricingMatrixLike;
};

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

const LEFT_COL_WIDTHS = [400, 150, 150] as const;
const LEFT_TABLE_WIDTH = LEFT_COL_WIDTHS.reduce((a, b) => a + b, 0);
const PRICE_COL_WIDTH = 140;

const HEAD_ROW_H = 40;
const SUBHEAD_ROW_H = 36;
const BODY_ROW_H = 80;

function LoadingLeftBody({ rowCount }: { rowCount: number }) {
    return (
        <>
            {Array.from({ length: rowCount }).map((_, i) => (
                <PTableRow key={`lsk-${i}`} className="hover:bg-transparent">
                    <PTableCell className="h-[80px] w-[400px]">
                        <Skeleton className="mb-1.5 h-4 w-[260px]" />
                        <Skeleton className="h-3 w-[160px]" />
                    </PTableCell>
                    <PTableCell className="h-[80px] w-[150px]"><Skeleton className="h-4 w-[120px]" /></PTableCell>
                    <PTableCell className="h-[80px] w-[150px]"><Skeleton className="h-4 w-[100px]" /></PTableCell>
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
                        <PTableCell key={`rskc-${i}-${j}`} className="h-[80px] border-l align-top">
                            <Skeleton className="h-8 w-full rounded-md" />
                            <Skeleton className="mt-2 h-3 w-[56px]" />
                        </PTableCell>
                    ))}
                </PTableRow>
            ))}
        </>
    );
}

export default function PricingTable({ matrix }: Props) {
    const usedUnits: Unit[] = Array.isArray(matrix.usedUnits) ? matrix.usedUnits : [];
    const uomCount = Math.max(1, usedUnits.length);

    const tiers = React.useMemo(() => {
        const selectedIds = matrix.filters.price_type_ids;
        const showList = matrix.filters.show_list_price;

        // If nothing is specifically selected, show everything (Default)
        if (selectedIds.length === 0 && !showList) {
            return [...matrix.TIERS];
        }

        // Otherwise show only what is selected
        const selectedNames = matrix.priceTypes
            .filter((pt) => selectedIds.includes(pt.price_type_id))
            .map((pt) => pt.price_type_name);

        return matrix.TIERS.filter((t) => {
            if (t === "LIST") return showList;
            return selectedNames.includes(t);
        });
    }, [matrix.TIERS, matrix.filters.show_list_price, matrix.filters.price_type_ids, matrix.priceTypes]);

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
        if (!sc || !tr) return;

        setMetrics({
            scrollLeft: sc.scrollLeft,
            scrollWidth: Math.max(1, sc.scrollWidth),
            clientWidth: Math.max(1, sc.clientWidth),
            trackWidth: Math.max(1, tr.clientWidth),
        });
    }, []);

    React.useEffect(() => {
        readMetrics();

        const sc = priceScrollRef.current;
        const tr = trackRef.current;
        if (!sc || !tr) return;

        const onResize = () => readMetrics();
        window.addEventListener("resize", onResize);

        const ro = new ResizeObserver(() => readMetrics());
        ro.observe(sc);
        ro.observe(tr);

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

    return (
        <div className="relative z-0 flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border bg-background shadow-sm">
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

            <div className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
                <div className="flex min-w-0">
                    {/* LEFT */}
                    <div className="shrink-0 border-r bg-background" style={{ width: LEFT_TABLE_WIDTH }}>
                        <div className="sticky top-0 z-10 overflow-hidden bg-background">
                            <PTable className="pmx-table table-fixed" style={{ width: LEFT_TABLE_WIDTH }}>
                                <colgroup>
                                    <col style={{ width: LEFT_COL_WIDTHS[0] }} />
                                    <col style={{ width: LEFT_COL_WIDTHS[1] }} />
                                    <col style={{ width: LEFT_COL_WIDTHS[2] }} />
                                </colgroup>

                                <PTableHeader>
                                    <PTableRow style={{ height: HEAD_ROW_H }}>
                                        <PTableHead className={headCellBase}>
                                            <div style={{ height: HEAD_ROW_H }} className="flex items-center px-3">Product</div>
                                        </PTableHead>
                                        <PTableHead className={headCellBase}>
                                            <div style={{ height: HEAD_ROW_H }} className="flex items-center px-3">Category</div>
                                        </PTableHead>
                                        <PTableHead className={cn(headCellBase, "border-r")}>
                                            <div style={{ height: HEAD_ROW_H }} className="flex items-center px-3">Brand</div>
                                        </PTableHead>
                                    </PTableRow>

                                    <PTableRow style={{ height: SUBHEAD_ROW_H }}>
                                        {Array.from({ length: 3 }).map((_, i) => (
                                            <PTableHead
                                                key={`left-sp-${i}`}
                                                className={cn(subHeadCellBase, i === 2 ? "border-r" : "")}
                                            >
                                                <div style={{ height: SUBHEAD_ROW_H }} className="px-3">
                                                    <span className="sr-only">Spacer</span>
                                                </div>
                                            </PTableHead>
                                        ))}
                                    </PTableRow>
                                </PTableHeader>
                            </PTable>
                        </div>

                        <PTable className="pmx-table table-fixed" style={{ width: LEFT_TABLE_WIDTH }}>
                            <colgroup>
                                <col style={{ width: LEFT_COL_WIDTHS[0] }} />
                                <col style={{ width: LEFT_COL_WIDTHS[1] }} />
                                <col style={{ width: LEFT_COL_WIDTHS[2] }} />
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
                                                <PTableCell className="p-0 border-b" style={{ width: LEFT_COL_WIDTHS[0], height: BODY_ROW_H }}>
                                                    <div style={{ height: BODY_ROW_H }} className="flex flex-col justify-center gap-1.5 px-3">
                                                        <span className="text-[13px] font-semibold leading-tight text-foreground/90 whitespace-normal">
                                                            {display.product_name ?? "—"}
                                                        </span>
                                                        <div className="flex items-center gap-2 text-[11px] leading-none text-muted-foreground/80">
                                                            <span className="flex items-center gap-1 rounded bg-muted/40 px-1.5 py-0.5 border border-muted-foreground/10 truncate">
                                                                Code: <span className="font-medium text-foreground/80">{display.product_code ?? "—"}</span>
                                                            </span>
                                                            <span className="flex items-center gap-1 rounded bg-muted/40 px-1.5 py-0.5 border border-muted-foreground/10 truncate">
                                                                Barcode: <span className="font-medium text-foreground/80">{display.barcode ?? "—"}</span>
                                                            </span>
                                                        </div>
                                                    </div>
                                                </PTableCell>
                                                <PTableCell className="p-0 border-b overflow-hidden" style={{ width: LEFT_COL_WIDTHS[1], height: BODY_ROW_H }}>
                                                    <div style={{ height: BODY_ROW_H }} className="flex items-center px-3 truncate text-[13px] text-muted-foreground">
                                                        {r.category_name ?? "—"}
                                                    </div>
                                                </PTableCell>
                                                <PTableCell className="p-0 border-b overflow-hidden" style={{ width: LEFT_COL_WIDTHS[2], height: BODY_ROW_H }}>
                                                    <div style={{ height: BODY_ROW_H }} className="flex items-center px-3 truncate text-[13px] text-muted-foreground">
                                                        {r.brand_name ?? "—"}
                                                    </div>
                                                </PTableCell>
                                            </PTableRow>
                                        );
                                    })}

                                {!loading && totalGroups === 0 ? (
                                    <PTableRow>
                                        <PTableCell colSpan={3} className="py-10 text-center text-muted-foreground">
                                            No products found.
                                        </PTableCell>
                                    </PTableRow>
                                ) : null}
                            </PTableBody>
                        </PTable>
                    </div>

                    {/* RIGHT */}
                    <div className="min-w-0 flex-1">
                        <div className="sticky top-0 z-10 bg-background">
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
                        >                            <div className="w-max min-w-full">
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
                                                                const dirty = matrix.isDirty(variantProductId, tier);
                                                                const err = toErrorString(matrix.getError(variantProductId, tier));

                                                                return (
                                                                    <PTableCell
                                                                        key={`${groupKey}-${String(tier)}-${String(uomId)}`}
                                                                        className={cn("p-0 border-b", st.cell, st.border, borderL)}
                                                                        style={{ height: BODY_ROW_H, width: PRICE_COL_WIDTH }}
                                                                    >
                                                                        <div style={{ height: BODY_ROW_H }} className="flex items-center justify-center px-3">
                                                                            <div className="w-full">
                                                                                <PriceCell
                                                                                    value={val}
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

                        <div className="border-t bg-background/60 px-3 py-2">
                            <div
                                ref={trackRef}
                                onMouseDown={onTrackClick}
                                className={cn(
                                    "relative h-3 w-full rounded-full bg-muted/70 ring-1 ring-border/60",
                                    maxScrollLeft <= 0 ? "opacity-40" : "opacity-100"
                                )}
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
                    </div>
                </div>
            </div>

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