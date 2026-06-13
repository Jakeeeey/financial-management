"use client";

import * as React from "react";
import type { ListMeta, PriceChangeRequestRow, CostChangeRequestRow } from "../types";
import { productLabel, priceTypeLabel, uomLabel } from "../utils/labels";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { pcrApproveButtonClass, pcrRejectButtonClass, pcrStatusBadgeClass } from "../utils/pcrStatusStyles";

function fmt(v: number | string | null | undefined) {
    const n = Number(v);
    if (!Number.isFinite(n)) return "—";
    return n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function requestedAtParts(value: string | null | undefined) {
    if (!value) return { date: "—", time: "" };
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return { date: "—", time: "" };

    return {
        date: date.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }),
        time: date.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" }),
    };
}

function safeInt(v: number | string | null | undefined, fallback = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
}

function clamp(n: number, min: number, max: number) {
    return Math.max(min, Math.min(max, n));
}

function getTotal(meta?: ListMeta | null) {
    return safeInt(meta?.total_count, 0);
}

function getTotalPages(meta: ListMeta | null | undefined, pageSize: number, currentRowsLength: number) {
    const total = getTotal(meta);
    if (total > 0) {
        return Math.max(1, Math.ceil(total / pageSize));
    }
    if (currentRowsLength >= pageSize) {
        return 0;
    }
    return 0;
}

type LoadingTableBodyProps = {
    rowCount: number;
    showSelectionColumn: boolean;
    showTypeColumn: boolean;
    showActionsColumn: boolean;
};

function LoadingTableBody({
    rowCount,
    showSelectionColumn,
    showTypeColumn,
    showActionsColumn,
}: LoadingTableBodyProps) {
    return (
        <>
            {Array.from({ length: rowCount }).map((_, index) => (
                <TableRow key={`loading-row-${index}`} className="hover:bg-transparent">
                    {showSelectionColumn ? (
                        <TableCell className="px-2">
                            <div className="flex items-center justify-center">
                                <Skeleton className="h-[18px] w-[18px] rounded-sm" />
                            </div>
                        </TableCell>
                    ) : null}
                    <TableCell className="px-2">
                        <Skeleton className="h-4 w-14" />
                    </TableCell>
                    <TableCell className="px-2">
                        <Skeleton className="h-4 w-full max-w-[180px]" />
                    </TableCell>
                    <TableCell className="px-2">
                        <Skeleton className="h-5 w-10 rounded-md" />
                    </TableCell>
                    {showTypeColumn ? (
                        <TableCell className="px-2">
                            <Skeleton className="h-4 w-12" />
                        </TableCell>
                    ) : null}
                    <TableCell className="px-2">
                        <div className="flex flex-col items-end gap-1">
                            <Skeleton className="h-4 w-16" />
                            <Skeleton className="h-3 w-20" />
                        </div>
                    </TableCell>
                    <TableCell className="px-2">
                        <Skeleton className="h-5 w-16 rounded-full" />
                    </TableCell>
                    <TableCell className="px-2">
                        <Skeleton className="mb-1 h-3 w-16" />
                        <Skeleton className="h-3 w-12" />
                    </TableCell>
                    {showActionsColumn ? (
                        <TableCell className="px-2 text-right">
                            <div className="inline-flex justify-end gap-1">
                                <Skeleton className="h-7 w-14 rounded-md" />
                                <Skeleton className="h-7 w-16 rounded-md" />
                                <Skeleton className="h-7 w-14 rounded-md" />
                            </div>
                        </TableCell>
                    ) : null}
                </TableRow>
            ))}
        </>
    );
}

type Props = {
    rows: (PriceChangeRequestRow | CostChangeRequestRow)[];
    mode: "approver" | "mine" | "all";
    requestType?: "price" | "cost" | "mixed";
    loading?: boolean;
    hasLoadError?: boolean;
    acting?: boolean;
    onApprove?: (id: number) => void;
    onReject?: (id: number) => void;
    onReview?: (id: number) => void;
    onCancel?: (id: number) => void;
    canSelectRow?: (row: PriceChangeRequestRow | CostChangeRequestRow) => boolean;
    canReviewRow?: (row: PriceChangeRequestRow | CostChangeRequestRow) => boolean;
    canApproveRow?: (row: PriceChangeRequestRow | CostChangeRequestRow) => boolean;
    canRejectRow?: (row: PriceChangeRequestRow | CostChangeRequestRow) => boolean;

    meta?: ListMeta | null;
    page: number;
    pageSize: number;
    onPageChange: (page: number) => void;
    onPageSizeChange?: (pageSize: number) => void;

    footerItemLabel?: string;

    selectedIds?: number[];
    selectedKeys?: string[];
    getSelectionKey?: (row: PriceChangeRequestRow | CostChangeRequestRow) => string;
    onToggleSelect?: (
        key: string,
        checked: boolean,
        row?: PriceChangeRequestRow | CostChangeRequestRow,
    ) => void;
    onToggleSelectAllPage?: (checked: boolean) => void;

    showSelectionColumn?: boolean;
    showActionsColumn?: boolean;
};

export default function RequestsTable(props: Props) {
    const mode = props.mode;
    const canSelectRow = props.canSelectRow;
    const getSelectionKey = props.getSelectionKey;
    const requestType = props.requestType ?? "price";
    const rows = React.useMemo<(PriceChangeRequestRow | CostChangeRequestRow)[]>(
        () => props.rows ?? [],
        [props.rows],
    );
    const page = Math.max(1, safeInt(props.page, 1));
    const pageSize = Math.max(1, safeInt(props.pageSize, 50));

    const total = getTotal(props.meta);
    const totalPages = getTotalPages(props.meta, pageSize, rows.length);

    const canPrev = page > 1;
    const inferredHasNext = rows.length >= pageSize;
    const canNext = totalPages > 0 ? page < totalPages : inferredHasNext;

    const startIndex = rows.length ? (page - 1) * pageSize + 1 : 0;
    const endIndex = rows.length ? startIndex + rows.length - 1 : 0;

    const itemLabel = (props.footerItemLabel ?? "requests").trim() || "requests";

    const resolveSelectionKey = React.useCallback(
        (row: PriceChangeRequestRow | CostChangeRequestRow) =>
            getSelectionKey?.(row) ?? String(Number(row.request_id)),
        [getSelectionKey],
    );

    const selectedKeySet = React.useMemo(() => {
        if (props.selectedKeys) return new Set(props.selectedKeys);
        return new Set((props.selectedIds ?? []).map((id) => String(id)));
    }, [props.selectedIds, props.selectedKeys]);

    const showSelectionColumn = props.showSelectionColumn ?? mode === "approver";
    const showActionsColumn =
        props.showActionsColumn ?? Boolean(props.onReview || props.onApprove || props.onReject);

    const selectableRows = React.useMemo(
        () =>
            showSelectionColumn
                ? rows.filter((r) => r.status === "PENDING" && (canSelectRow?.(r) ?? true))
                : [],
        [canSelectRow, showSelectionColumn, rows],
    );

    const selectableKeys = React.useMemo(
        () => selectableRows.map((r) => resolveSelectionKey(r)),
        [resolveSelectionKey, selectableRows],
    );

    const canToggleSelect = Boolean(props.onToggleSelect);
    const canToggleSelectAllPage = Boolean(props.onToggleSelectAllPage);
    const selectedOnPageCount = selectableKeys.filter((key) => selectedKeySet.has(key)).length;
    const allPageSelected = selectableKeys.length > 0 && selectedOnPageCount === selectableKeys.length;
    const somePageSelected = selectedOnPageCount > 0 && selectedOnPageCount < selectableKeys.length;

    const showTypeColumn = requestType !== "cost";
    const loading = Boolean(props.loading);
    const hasLoadError = Boolean(props.hasLoadError);
    const skeletonRowCount = Math.min(pageSize, 8);
    let colSpan = 6;
    if (showTypeColumn) colSpan += 1;
    if (showSelectionColumn) colSpan += 1;
    if (showActionsColumn) colSpan += 1;

    return (
        <div className="overflow-hidden rounded-xl border bg-background">
            <Table className="w-full table-fixed">
                <TableHeader className="sticky top-0 z-10 bg-background shadow-sm">
                    <TableRow>
                        {showSelectionColumn ? (
                            <TableHead className="w-10 px-2">
                                <Checkbox
                                    checked={allPageSelected ? true : somePageSelected ? "indeterminate" : false}
                                    onCheckedChange={(checked) => props.onToggleSelectAllPage?.(checked === true)}
                                    aria-label="Select all pending requests on this page"
                                    disabled={selectableKeys.length === 0 || props.acting || !canToggleSelectAllPage}
                                />
                            </TableHead>
                        ) : null}
                        <TableHead className="w-[88px] px-2">Request #</TableHead>
                        <TableHead className="px-2">Product</TableHead>
                        <TableHead className="w-[72px] px-2">UOM</TableHead>
                        {showTypeColumn && <TableHead className="w-[78px] px-2">Type</TableHead>}
                        <TableHead className="w-[112px] px-2 text-right">Proposed</TableHead>
                        <TableHead className="w-[102px] px-2">Status</TableHead>
                        <TableHead className="w-[108px] px-2">Requested</TableHead>
                        {showActionsColumn ? (
                            <TableHead className="w-[188px] px-2 text-right">Actions</TableHead>
                        ) : null}
                    </TableRow>
                </TableHeader>

                <TableBody>
                    {rows.map((r) => {
                        const id = Number(r.request_id);
                        const selectionKey = resolveSelectionKey(r);
                        const isPending = r.status === "PENDING";
                        const isSelected = selectedKeySet.has(selectionKey);
                        const isCostRow = "proposed_cost" in r;
                        const rowType = requestType === "mixed" ? (isCostRow ? "cost" : "price") : requestType;
                        const canSelect = props.canSelectRow?.(r) ?? true;
                        const canReview = props.canReviewRow?.(r) ?? true;
                        const canApprove = props.canApproveRow?.(r) ?? true;
                        const canReject = props.canRejectRow?.(r) ?? true;

                        const proposedValue = rowType === "cost"
                            ? (r as CostChangeRequestRow).proposed_cost
                            : (r as PriceChangeRequestRow).proposed_price;
                        const requestedAt = requestedAtParts(r.requested_at);

                        return (
                            <TableRow key={selectionKey}>
                                {showSelectionColumn ? (
                                <TableCell className="px-2">
                                    <div className="flex items-center justify-center">
                                        <Checkbox
                                            className="h-[18px] w-[18px]"
                                            checked={isSelected}
                                            onCheckedChange={(checked) =>
                                                props.onToggleSelect?.(selectionKey, checked === true, r)
                                            }
                                            aria-label={`Select request ${rowType === "cost" ? "CCR" : "PCR"}-${id}`}
                                            disabled={props.acting || !isPending || !canToggleSelect || !canSelect}
                                        />
                                    </div>
                                </TableCell>
                                ) : null}

                                <TableCell className="truncate px-2 font-medium" title={`${rowType === "cost" ? "CCR" : "PCR"}-${id}`}>
                                    {rowType === "cost" ? "CCR" : "PCR"}-{id}
                                </TableCell>
                                <TableCell className="min-w-0 truncate px-2" title={productLabel(r as PriceChangeRequestRow)}>
                                    {productLabel(r as PriceChangeRequestRow)}
                                </TableCell>
                                <TableCell className="px-2">
                                    <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                                        {uomLabel(r as PriceChangeRequestRow)}
                                    </span>
                                </TableCell>
                                {showTypeColumn && (
                                    <TableCell className="truncate px-2" title={rowType === "cost" ? "List Cost" : priceTypeLabel(r as PriceChangeRequestRow)}>
                                        <span className="block truncate">
                                            {rowType === "cost" ? "List Cost" : priceTypeLabel(r as PriceChangeRequestRow)}
                                        </span>
                                    </TableCell>
                                )}
                                <TableCell className="px-2 text-right">
                                    <div className="flex flex-col items-end gap-0.5">
                                        <div className="text-sm font-semibold">{fmt(proposedValue)}</div>
                                        {(() => {
                                            const currentCost = rowType === "cost"
                                                ? (r as CostChangeRequestRow).current_cost
                                                : typeof r.product_id === "object" ? r.product_id.cost_per_unit : null;
                                            
                                            const currentNum = Number(currentCost);
                                            const proposedNum = Number(proposedValue);
                                            
                                            if (currentNum > 0 && Number.isFinite(proposedNum)) {
                                                const diffPct = ((proposedNum - currentNum) / currentNum) * 100;
                                                return (
                                                    <div className="flex max-w-full items-center gap-1 text-xs">
                                                        <span className="text-muted-foreground line-through" title="Cost Price">{fmt(currentNum)}</span>
                                                        <span className={diffPct > 0 ? "text-green-600 dark:text-green-400 font-medium" : diffPct < 0 ? "text-red-600 dark:text-red-400 font-medium" : "text-muted-foreground font-medium"}>
                                                            {diffPct > 0 ? "+" : ""}{diffPct.toFixed(2)}%
                                                        </span>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        })()}
                                    </div>
                                </TableCell>
                                <TableCell className="px-2">
                                    <Badge variant="outline" className={`${pcrStatusBadgeClass(r.status)} max-w-full truncate px-2 text-[11px]`}>
                                        {r.status}
                                    </Badge>
                                </TableCell>
                                <TableCell className="px-2">
                                    <div className="min-w-0 text-xs leading-tight">
                                        <div className="truncate">{requestedAt.date}</div>
                                        {requestedAt.time ? (
                                            <div className="truncate text-muted-foreground">{requestedAt.time}</div>
                                        ) : null}
                                    </div>
                                </TableCell>

                                {showActionsColumn ? (
                                    <TableCell className="whitespace-nowrap px-2 text-right">
                                        <div className="inline-flex flex-nowrap items-center justify-end gap-1">
                                            {props.onReview && canReview ? (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-7 px-2 text-[11px]"
                                                    onClick={() => props.onReview?.(id)}
                                                    disabled={props.acting}
                                                    aria-label="Review request"
                                                >
                                                    Review
                                                </Button>
                                            ) : null}
                                            <Button
                                                size="sm"
                                                className={`${pcrApproveButtonClass} h-7 px-2 text-[11px]`}
                                                onClick={() => props.onApprove?.(id)}
                                                disabled={props.acting || !isPending || !props.onApprove || !canApprove}
                                            >
                                                Approve
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className={`${pcrRejectButtonClass} h-7 px-2 text-[11px]`}
                                                onClick={() => props.onReject?.(id)}
                                                disabled={props.acting || !isPending || !props.onReject || !canReject}
                                            >
                                                Reject
                                            </Button>
                                        </div>
                                    </TableCell>
                                ) : null}
                            </TableRow>
                        );
                    })}

                    {rows.length === 0 && loading ? (
                        <LoadingTableBody
                            rowCount={skeletonRowCount}
                            showSelectionColumn={showSelectionColumn}
                            showTypeColumn={showTypeColumn}
                            showActionsColumn={showActionsColumn}
                        />
                    ) : rows.length === 0 && !hasLoadError ? (
                        <TableRow>
                            <TableCell colSpan={colSpan} className="py-10 text-center text-muted-foreground">
                                No requests found.
                            </TableCell>
                        </TableRow>
                    ) : null}
                </TableBody>
            </Table>

            <div className="flex flex-col gap-3 border-t px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-muted-foreground">
                    {total > 0 ? (
                        <>
                            Showing <span className="font-medium text-foreground">{startIndex}</span> –{" "}
                            <span className="font-medium text-foreground">{endIndex}</span> of{" "}
                            <span className="font-medium text-foreground">{total}</span> {itemLabel}
                        </>
                    ) : (
                        <>
                            Showing <span className="font-medium text-foreground">{startIndex}</span> –{" "}
                            <span className="font-medium text-foreground">{endIndex}</span> {itemLabel}
                        </>
                    )}
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2">
                    {props.onPageSizeChange ? (
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Rows</span>
                            <select
                                className="h-9 rounded-md border bg-background px-2 text-sm"
                                value={String(pageSize)}
                                onChange={(e) => {
                                    const nextSize = clamp(safeInt(e.target.value, pageSize), 1, 500);
                                    props.onPageSizeChange?.(nextSize);
                                    props.onPageChange(1);
                                }}
                            >
                                {[25, 50, 100, 200].map((n) => (
                                    <option key={n} value={String(n)}>
                                        {n} / page
                                    </option>
                                ))}
                            </select>
                        </div>
                    ) : null}

                    <Button variant="outline" size="sm" disabled={loading || !canPrev} onClick={() => props.onPageChange(page - 1)}>
                        Prev
                    </Button>

                    <Button
                        variant="outline"
                        size="sm"
                        disabled={loading || !canNext}
                        onClick={() => props.onPageChange(totalPages > 0 ? Math.min(page + 1, totalPages) : page + 1)}
                    >
                        Next
                    </Button>
                </div>
            </div>
        </div>
    );
}
