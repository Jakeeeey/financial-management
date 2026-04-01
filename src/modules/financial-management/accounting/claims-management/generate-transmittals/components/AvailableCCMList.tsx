// src/modules/financial-management/claims-management/generate-transmittals/components/AvailableCCMList.tsx
"use client";

import * as React from "react";
import type { CCMRow } from "../utils/types";
import { formatPHP, toNumberSafe } from "../utils/format";

import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

// If your project already has shadcn Select, use it.
// If not, tell me and I'll swap this to your AsyncCombobox quickly.
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

type Props = {
    rows: CCMRow[];
    loading: boolean;
    selectedIds: number[];
    onToggle: (id: number, checked: boolean) => void;

    // ✅ UPDATED: allow passing which IDs to select-all (visible rows only)
    onToggleAll: (checked: boolean, ids?: number[]) => void;
};

function coaLabel(r: CCMRow) {
    const gl = String(r.gl_code ?? "").trim();
    const title = String(r.account_title ?? "").trim();
    if (gl && title) return `${gl} — ${title}`;
    if (title) return title;
    if (gl) return gl;
    const id = r.coa_id;
    return id ? `COA #${id}` : "—";
}

function customerLabel(r: CCMRow) {
    const name = String(r.customer_name ?? "").trim();
    if (name) return name;
    const id = r.customer_id;
    return id ? `Customer #${id}` : "—";
}

export function AvailableCCMList({
                                     rows,
                                     loading,
                                     selectedIds,
                                     onToggle,
                                     onToggleAll,
                                 }: Props) {
    const selectedSet = React.useMemo(() => new Set(selectedIds), [selectedIds]);

    // ✅ Build COA filter options from loaded CCM rows
    const coaOptions = React.useMemo(() => {
        const map = new Map<number, string>();
        for (const r of rows) {
            const id = r.coa_id;
            if (!id || !Number.isFinite(Number(id))) continue;
            if (!map.has(Number(id))) map.set(Number(id), coaLabel(r));
        }
        return Array.from(map.entries())
            .map(([id, label]) => ({ id, label }))
            .sort((a, b) => a.label.localeCompare(b.label));
    }, [rows]);

    const [coaFilter, setCoaFilter] = React.useState<number | "all">("all");

    // Reset filter if it becomes invalid after reload
    React.useEffect(() => {
        if (coaFilter === "all") return;
        const stillExists = coaOptions.some((o) => o.id === coaFilter);
        if (!stillExists) setCoaFilter("all");
    }, [coaFilter, coaOptions]);

    const customerOptions = React.useMemo(() => {
        const map = new Map<number, string>();
        for (const r of rows) {
            const id = Number(r.customer_id);
            if (!Number.isFinite(id) || id <= 0) continue;

            const name = String(r.customer_name ?? "").trim();
            if (!map.has(id)) map.set(id, name || `Customer #${id}`);
        }

        return Array.from(map.entries())
            .map(([id, label]) => ({ id, label }))
            .sort((a, b) => a.label.localeCompare(b.label));
    }, [rows]);

    const [customerFilter, setCustomerFilter] = React.useState<number | "all">("all");
    const visibleRows = React.useMemo(() => {
        return rows.filter((r) => {
            if (coaFilter !== "all" && Number(r.coa_id) !== coaFilter) return false;
            if (customerFilter !== "all" && Number(r.customer_id) !== customerFilter) return false;
            return true;
        });
    }, [rows, coaFilter, customerFilter]);
    React.useEffect(() => {
        if (customerFilter === "all") return;
        const stillExists = customerOptions.some((o) => o.id === customerFilter);
        if (!stillExists) setCustomerFilter("all");
    }, [customerFilter, customerOptions]);
    const allChecked =
        visibleRows.length > 0 && visibleRows.every((r) => selectedSet.has(r.id));
    const anyChecked = visibleRows.some((r) => selectedSet.has(r.id));

    return (
        <div className="space-y-3">
            {/* Top row: counts + COA filter + select all */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div className="space-y-1">
                    <div className="text-sm text-muted-foreground">
                        {rows.length ? (
                            <>
                                {visibleRows.length} item(s)
                                {anyChecked ? (
                                    <>
                                        {" "}
                                        •{" "}
                                        <span className="text-foreground font-medium">
                      {selectedIds.length} selected
                    </span>
                                    </>
                                ) : null}
                            </>
                        ) : (
                            <>No items</>
                        )}
                    </div>

                    {/* COA filter */}
                    <div className="flex flex-col gap-1">
                        <div className="text-xs text-muted-foreground">Filter by Chart of Accounts</div>
                        <Select
                            value={coaFilter === "all" ? "all" : String(coaFilter)}
                            onValueChange={(v) => setCoaFilter(v === "all" ? "all" : Number(v))}
                            disabled={loading || rows.length === 0 || coaOptions.length === 0}
                        >
                            <SelectTrigger className="h-9 w-full sm:w-[420px]">
                                <SelectValue placeholder="All COA" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All COA</SelectItem>
                                {coaOptions.map((o) => (
                                    <SelectItem key={o.id} value={String(o.id)}>
                                        {o.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <div className="flex flex-col gap-1">
                    <div className="text-xs text-muted-foreground">Filter by Customer</div>
                    <Select
                        value={customerFilter === "all" ? "all" : String(customerFilter)}
                        onValueChange={(v) => setCustomerFilter(v === "all" ? "all" : Number(v))}
                        disabled={loading || rows.length === 0 || customerOptions.length === 0}
                    >
                        <SelectTrigger className="h-9 w-full sm:w-[420px]">
                            <SelectValue placeholder="All Customers" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Customers</SelectItem>
                            {customerOptions.map((o) => (
                                <SelectItem key={o.id} value={String(o.id)}>
                                    {o.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={loading || visibleRows.length === 0}
                        onClick={() =>
                            onToggleAll(!allChecked, visibleRows.map((r) => r.id))
                        }
                    >
                        {allChecked ? "Clear all" : "Select all"}
                    </Button>
                </div>
            </div>

            {/* Table */}
            <div className="rounded-xl border bg-background">
                <ScrollArea className="w-full">
                    <div className="min-w-[980px]">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[44px]" />
                                    <TableHead className="w-[200px]">CCM No.</TableHead>
                                    <TableHead className="w-[320px]">Customer</TableHead>
                                    <TableHead>Chart of Accounts</TableHead>
                                    <TableHead className="w-[160px] text-right">Amount</TableHead>
                                </TableRow>
                            </TableHeader>

                            <TableBody>
                                {loading ? (
                                    Array.from({ length: 8 }).map((_, i) => (
                                        <TableRow key={i}>
                                            <TableCell>
                                                <Skeleton className="h-5 w-5 rounded" />
                                            </TableCell>
                                            <TableCell>
                                                <Skeleton className="h-4 w-32" />
                                                <Skeleton className="mt-2 h-3 w-44" />
                                            </TableCell>
                                            <TableCell>
                                                <Skeleton className="h-4 w-64" />
                                            </TableCell>
                                            <TableCell>
                                                <Skeleton className="h-4 w-[520px]" />
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Skeleton className="ml-auto h-4 w-24" />
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : visibleRows.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5}>
                                            <div className="p-6 text-center text-sm text-muted-foreground">
                                                {rows.length === 0
                                                    ? "No available customer memos for this supplier."
                                                    : "No CCMs match the selected Chart of Accounts."}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    visibleRows.map((r) => {
                                        const checked = selectedSet.has(r.id);
                                        const amount = formatPHP(toNumberSafe(r.amount));

                                        return (
                                            <TableRow key={r.id} className="hover:bg-muted/40">
                                                <TableCell>
                                                    <Checkbox
                                                        checked={checked}
                                                        onCheckedChange={(v) =>
                                                            onToggle(r.id, Boolean(v))
                                                        }
                                                        aria-label={`Select ${r.memo_number}`}
                                                    />
                                                </TableCell>

                                                <TableCell className="align-top">
                                                    <div className="font-semibold">{r.memo_number || "—"}</div>
                                                    <div
                                                        className="mt-0.5 line-clamp-1 text-xs text-muted-foreground"
                                                        title={r.reason ?? ""}
                                                    >
                                                        {r.reason ?? "—"}
                                                    </div>
                                                </TableCell>

                                                <TableCell className="align-top">
                                                    <div className="truncate" title={customerLabel(r)}>
                                                        {customerLabel(r)}
                                                    </div>
                                                </TableCell>

                                                <TableCell className="align-top">
                                                    <div className="truncate" title={coaLabel(r)}>
                                                        {coaLabel(r)}
                                                    </div>
                                                </TableCell>

                                                <TableCell className="align-top text-right font-mono">
                                                    {amount}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>
                    <ScrollBar orientation="horizontal" />
                </ScrollArea>
            </div>
        </div>
    );
}