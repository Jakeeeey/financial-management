"use client";

import React, { useState, useMemo } from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Edit2, Eye, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { CollectionSummary, CashieringState } from "../../types";
import { format, isValid } from "date-fns";
import { cn } from "@/lib/utils";

interface MasterListProps {
    data: CollectionSummary[];
    isLoading: boolean;
    state: CashieringState;
}

export default function CashieringMasterList({ data, isLoading, state }: MasterListProps) {
    const [sortField, setSortField] = useState<keyof CollectionSummary | null>("date");
    const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

    const handleSort = (field: keyof CollectionSummary) => {
        if (sortField === field) {
            setSortDirection(sortDirection === "asc" ? "desc" : "asc");
        } else {
            setSortField(field);
            setSortDirection("asc");
        }
    };

    const sortedData = useMemo(() => {
        if (!sortField) return data;

        return [...data].sort((a, b) => {
            const aVal = a[sortField];
            const bVal = b[sortField];

            if (aVal == null && bVal == null) return 0;
            if (aVal == null) return 1;
            if (bVal == null) return -1;

            const modifier = sortDirection === "asc" ? 1 : -1;
            return aVal > bVal ? modifier : -modifier;
        });
    }, [data, sortField, sortDirection]);

    const parseAnyDate = (val: string | number | Date | [number, number, number, number?, number?]): Date | null => {
        if (!val) return null;
        if (Array.isArray(val)) return new Date(val[0], val[1] - 1, val[2], val[3] || 0, val[4] || 0);
        const d = new Date(val);
        return isValid(d) ? d : null;
    };

    if (isLoading) {
        return (
            <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                ))}
            </div>
        );
    }

    return (
        <div className="rounded-md border border-border bg-card overflow-hidden">
            <Table>
                <TableHeader className="bg-muted/50">
                    <TableRow>
                        <TableHead
                            className="w-[150px] font-bold text-[11px] uppercase tracking-wider cursor-pointer hover:bg-muted/80 transition-colors"
                            onClick={() => handleSort("docNo")}
                        >
                            <div className="flex items-center gap-1">
                                <span>Doc / CP No.</span>
                                {sortField === "docNo" ? (
                                    sortDirection === "asc" ? <ArrowUp className="h-3 w-3 text-primary" /> : <ArrowDown className="h-3 w-3 text-primary" />
                                ) : (
                                    <ArrowUpDown className="h-3 w-3 text-muted-foreground opacity-50" />
                                )}
                            </div>
                        </TableHead>
                        <TableHead
                            className="font-bold text-[11px] uppercase tracking-wider cursor-pointer hover:bg-muted/80 transition-colors"
                            onClick={() => handleSort("date")}
                        >
                            <div className="flex items-center gap-1">
                                <span>Date Received</span>
                                {sortField === "date" ? (
                                    sortDirection === "asc" ? <ArrowUp className="h-3 w-3 text-primary" /> : <ArrowDown className="h-3 w-3 text-primary" />
                                ) : (
                                    <ArrowUpDown className="h-3 w-3 text-muted-foreground opacity-50" />
                                )}
                            </div>
                        </TableHead>
                        {/* 🚀 RENAMED TO COLLECTOR */}
                        <TableHead
                            className="font-bold text-[11px] uppercase tracking-wider cursor-pointer hover:bg-muted/80 transition-colors"
                            onClick={() => handleSort("salesmanName")}
                        >
                            <div className="flex items-center gap-1">
                                <span>Collector</span>
                                {sortField === "salesmanName" ? (
                                    sortDirection === "asc" ? <ArrowUp className="h-3 w-3 text-primary" /> : <ArrowDown className="h-3 w-3 text-primary" />
                                ) : (
                                    <ArrowUpDown className="h-3 w-3 text-muted-foreground opacity-50" />
                                )}
                            </div>
                        </TableHead>
                        <TableHead
                            className="font-bold text-[11px] uppercase tracking-wider cursor-pointer hover:bg-muted/80 transition-colors"
                            onClick={() => handleSort("status")}
                        >
                            <div className="flex items-center gap-1">
                                <span>Status</span>
                                {sortField === "status" ? (
                                    sortDirection === "asc" ? <ArrowUp className="h-3 w-3 text-primary" /> : <ArrowDown className="h-3 w-3 text-primary" />
                                ) : (
                                    <ArrowUpDown className="h-3 w-3 text-muted-foreground opacity-50" />
                                )}
                            </div>
                        </TableHead>
                        <TableHead
                            className="text-right font-bold text-[11px] uppercase tracking-wider cursor-pointer hover:bg-muted/80 transition-colors"
                            onClick={() => handleSort("amount")}
                        >
                            <div className="flex items-center gap-1 justify-end">
                                <span>Total Counted</span>
                                {sortField === "amount" ? (
                                    sortDirection === "asc" ? <ArrowUp className="h-3 w-3 text-primary" /> : <ArrowDown className="h-3 w-3 text-primary" />
                                ) : (
                                    <ArrowUpDown className="h-3 w-3 text-muted-foreground opacity-50" />
                                )}
                            </div>
                        </TableHead>
                        <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {sortedData.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={6} className="h-24 text-center text-muted-foreground italic">
                                No collection pouches found matching the filters.
                            </TableCell>
                        </TableRow>
                    ) : (
                        sortedData.map((col) => {
                            const safeDate = parseAnyDate(col.date);
                            const safeAmount = col.amount || 0;

                            return (
                                <TableRow key={col.id} className="group hover:bg-muted/30 transition-colors cursor-default">
                                    <TableCell className="font-mono font-bold text-primary">
                                        {col.docNo}
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                        {safeDate ? format(safeDate, "MMM dd, yyyy") : "---"}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="text-sm font-semibold text-foreground">{col.salesmanName}</span>
                                            <span className="text-[10px] font-mono text-muted-foreground uppercase">{col.salesmanCode}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge
                                            variant="outline"
                                            className={cn(
                                                "text-[10px] uppercase font-bold",
                                                col.status === "Draft"
                                                    ? "border-amber-500/50 text-amber-600 bg-amber-50/50 dark:bg-amber-900/20"
                                                    : "border-emerald-500/50 text-emerald-600 bg-emerald-50/50 dark:bg-emerald-900/20"
                                            )}
                                        >
                                            {col.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right font-bold text-sm text-foreground tracking-tight">
                                        ₱{safeAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {col.status === "Draft" ? (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-8 p-0 hover:text-primary"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    state.loadPouchForEdit(Number(col.id));
                                                }}
                                            >
                                                <Edit2 size={14} />
                                            </Button>
                                        ) : (
                                            <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 opacity-50 cursor-not-allowed">
                                                <Eye size={14} />
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            );
                        })
                    )}
                </TableBody>
            </Table>
        </div>
    );
}