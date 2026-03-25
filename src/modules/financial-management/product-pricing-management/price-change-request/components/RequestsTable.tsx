"use client";

import * as React from "react";
import type { ListMeta, PriceChangeRequestRow } from "../types";
import { productLabel, priceTypeLabel } from "../utils/labels";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

function fmt(v: number | string | null | undefined) {
    const n = Number(v);
    if (!Number.isFinite(n)) return "—";
    return n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

type Props = {
    rows: PriceChangeRequestRow[];
    mode: "approver" | "mine" | "all";
    acting?: boolean;
    onApprove?: (id: number) => void;
    onReject?: (id: number) => void;
    onCancel?: (id: number) => void;

    meta?: ListMeta | null;
    page: number;
    pageSize: number;
    onPageChange: (page: number) => void;
    onPageSizeChange?: (pageSize: number) => void;

    footerItemLabel?: string;

    selectedIds?: number[];
    onToggleSelect?: (id: number, checked: boolean) => void;
    onToggleSelectAllPage?: (checked: boolean) => void;
};

export default function RequestsTable(props: Props) {
    const rows = React.useMemo<PriceChangeRequestRow[]>(
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

    const selectedIdSet = React.useMemo(() => new Set(props.selectedIds ?? []), [props.selectedIds]);

    const selectableRows = React.useMemo(
        () =>
            props.mode === "approver"
                ? rows.filter((r) => r.status === "PENDING")
                : [],
        [props.mode, rows],
    );

    const selectableIds = React.useMemo(
        () => selectableRows.map((r) => Number(r.request_id)).filter((id) => Number.isFinite(id)),
        [selectableRows],
    );

    const selectedOnPageCount = selectableIds.filter((id) => selectedIdSet.has(id)).length;
    const allPageSelected = selectableIds.length > 0 && selectedOnPageCount === selectableIds.length;
    const somePageSelected = selectedOnPageCount > 0 && selectedOnPageCount < selectableIds.length;

    const colSpan = props.mode === "approver" ? 8 : 7;

    return (
        <div className="rounded-xl border bg-background">
            <Table>
                <TableHeader>
                    <TableRow>
                        {props.mode === "approver" && (
                            <TableHead className="w-[52px]">
                                <Checkbox
                                    checked={allPageSelected ? true : somePageSelected ? "indeterminate" : false}
                                    onCheckedChange={(checked) => props.onToggleSelectAllPage?.(checked === true)}
                                    aria-label="Select all pending requests on this page"
                                    disabled={selectableIds.length === 0 || props.acting}
                                />
                            </TableHead>
                        )}
                        <TableHead className="w-[110px]">Request #</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead className="w-[90px]">Type</TableHead>
                        <TableHead className="w-[140px] text-right">Proposed</TableHead>
                        <TableHead className="w-[140px]">Status</TableHead>
                        <TableHead className="w-[170px]">Requested At</TableHead>
                        <TableHead className="w-[220px] text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>

                <TableBody>
                    {rows.map((r) => {
                        const id = Number(r.request_id);
                        const isPending = r.status === "PENDING";
                        const isSelected = selectedIdSet.has(id);

                        return (
                            <TableRow key={id}>
                                {props.mode === "approver" && (
                                    <TableCell>
                                        <Checkbox
                                            checked={isSelected}
                                            onCheckedChange={(checked) => props.onToggleSelect?.(id, checked === true)}
                                            aria-label={`Select request ${id}`}
                                            disabled={props.acting || !isPending}
                                        />
                                    </TableCell>
                                )}

                                <TableCell className="font-medium">{id}</TableCell>
                                <TableCell className="max-w-[420px] truncate">{productLabel(r)}</TableCell>
                                <TableCell>{priceTypeLabel(r)}</TableCell>
                                <TableCell className="text-right">{fmt(r.proposed_price)}</TableCell>
                                <TableCell>
                                    <Badge variant={r.status === "PENDING" ? "default" : r.status === "APPROVED" ? "secondary" : "outline"}>
                                        {r.status}
                                    </Badge>
                                </TableCell>
                                <TableCell>{r.requested_at ? new Date(r.requested_at).toLocaleString() : "—"}</TableCell>

                                <TableCell className="text-right">
                                    <div className="inline-flex gap-2">
                                        {props.mode === "approver" && (
                                            <>
                                                <Button size="sm" onClick={() => props.onApprove?.(id)} disabled={props.acting || !isPending}>
                                                    Approve
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="destructive"
                                                    onClick={() => props.onReject?.(id)}
                                                    disabled={props.acting || !isPending}
                                                >
                                                    Reject
                                                </Button>
                                            </>
                                        )}

                                        {props.mode === "mine" && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => props.onCancel?.(id)}
                                                disabled={props.acting || !isPending}
                                            >
                                                Cancel
                                            </Button>
                                        )}
                                    </div>
                                </TableCell>
                            </TableRow>
                        );
                    })}

                    {rows.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={colSpan} className="py-10 text-center text-muted-foreground">
                                No requests found.
                            </TableCell>
                        </TableRow>
                    )}
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

                    <Button variant="outline" size="sm" disabled={!canPrev} onClick={() => props.onPageChange(page - 1)}>
                        Prev
                    </Button>

                    <Button
                        variant="outline"
                        size="sm"
                        disabled={!canNext}
                        onClick={() => props.onPageChange(totalPages > 0 ? Math.min(page + 1, totalPages) : page + 1)}
                    >
                        Next
                    </Button>
                </div>
            </div>
        </div>
    );
}