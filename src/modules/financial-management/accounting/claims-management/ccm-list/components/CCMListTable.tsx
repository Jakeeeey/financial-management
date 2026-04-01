//src/modules/financial-management-system/claims-management/ccm-list/components/CCMListTable.tsx
"use client";

import * as React from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Eye } from "lucide-react";

import { CCMStatusBadge } from "./CCMStatusBadge";
import type { CCMRow } from "../utils/types";
import { toNumberSafe } from "../utils/parse";
import { formatPHP } from "../utils/format";

type Props = {
    rows: CCMRow[];
    loading: boolean;
    onView: (row: CCMRow) => void;
};

export function CCMListTable({ rows, loading, onView }: Props) {
    return (
        <div className="rounded-xl border bg-background">
            <ScrollArea className="w-full">
                <div className="min-w-[980px]">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[120px]">Memo #</TableHead>

                                {/* Reason: constrained */}
                                <TableHead className="w-[420px]">Reason</TableHead>

                                <TableHead className="w-[140px] text-right">Amount</TableHead>

                                {/* Supplier & Customer constrained */}
                                <TableHead className="w-[260px]">Supplier</TableHead>
                                <TableHead className="w-[260px]">Customer</TableHead>

                                {/* ✅ Status moved near View */}
                                <TableHead className="w-[160px]">Status</TableHead>
                                <TableHead className="w-[120px]" />
                            </TableRow>
                        </TableHeader>

                        <TableBody>
                            {loading ? (
                                Array.from({ length: 10 }).map((_, i) => (
                                    <TableRow key={i}>
                                        {Array.from({ length: 7 }).map((__, j) => (
                                            <TableCell key={j}>
                                                <Skeleton className="h-4 w-full" />
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            ) : rows.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="py-10 text-center text-sm">
                                        No CCMs found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                rows.map((r) => {
                                    const amount = toNumberSafe(r.amount) ?? 0;

                                    const supplierText = String(
                                        r.supplier_name ?? r.supplier_id ?? "—"
                                    );
                                    const customerText = String(
                                        r.customer_name ?? r.customer_id ?? "—"
                                    );

                                    return (
                                        <TableRow key={r.id}>
                                            <TableCell className="font-mono text-xs">
                                                {r.memo_number || "—"}
                                            </TableCell>

                                            {/* Reason: truncate + title */}
                                            <TableCell className="max-w-[420px]">
                                                <div className="truncate text-sm" title={r.reason ?? ""}>
                                                    {r.reason ?? "—"}
                                                </div>
                                            </TableCell>

                                            <TableCell className="text-right font-mono text-xs">
                                                {formatPHP(amount)}
                                            </TableCell>

                                            {/* Supplier: truncate */}
                                            <TableCell className="max-w-[260px]">
                                                <div className="truncate text-sm" title={supplierText}>
                                                    {supplierText}
                                                </div>
                                            </TableCell>

                                            {/* Customer: truncate */}
                                            <TableCell className="max-w-[260px]">
                                                <div className="truncate text-sm" title={customerText}>
                                                    {customerText}
                                                </div>
                                            </TableCell>

                                            {/* ✅ Status beside actions */}
                                            <TableCell>
                                                <CCMStatusBadge status={r.status} />
                                            </TableCell>

                                            <TableCell className="text-right">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => onView(r)}
                                                >
                                                    <Eye className="mr-2 h-4 w-4" />
                                                    View
                                                </Button>
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
    );
}
