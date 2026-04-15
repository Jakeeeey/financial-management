"use client";

import React from "react";
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
import { Edit2, Eye } from "lucide-react";
import { CollectionSummary, CashieringState } from "../../types";
import { format } from "date-fns";

interface MasterListProps {
    data: CollectionSummary[];
    isLoading: boolean;
    state: CashieringState; // 🚀 Pass state to access loadPouchForEdit
}

export default function CashieringMasterList({ data, isLoading, state }: MasterListProps) {
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
                        <TableHead className="w-[150px] font-bold text-[11px] uppercase tracking-wider">Doc / CP No.</TableHead>
                        <TableHead className="font-bold text-[11px] uppercase tracking-wider">Date Received</TableHead>
                        <TableHead className="font-bold text-[11px] uppercase tracking-wider">Route Owner</TableHead>
                        <TableHead className="font-bold text-[11px] uppercase tracking-wider">Status</TableHead>
                        <TableHead className="text-right font-bold text-[11px] uppercase tracking-wider">Total Counted</TableHead>
                        <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {data.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={6} className="h-24 text-center text-muted-foreground italic">
                                No collection pouches found.
                            </TableCell>
                        </TableRow>
                    ) : (
                        data.map((col) => (
                            <TableRow key={col.id} className="group hover:bg-muted/30 transition-colors cursor-default">
                                <TableCell className="font-mono font-bold text-primary">
                                    {col.docNo}
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                    {col.date ? format(new Date(col.date), "MMM dd, yyyy") : "---"}
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
                                    ₱{col.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </TableCell>
                                <TableCell className="text-right">
                                    {col.status === "Draft" ? (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 w-8 p-0 hover:text-primary"
                                            onClick={() => state.loadPouchForEdit(Number(col.id))}
                                        >
                                            <Edit2 size={14} />
                                        </Button>
                                    ) : (
                                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 opacity-50 cursor-not-allowed">
                                            <Eye size={14} />
                                        </Button>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        </div>
    );
}

function cn(...classes: string[]) {
    return classes.filter(Boolean).join(" ");
}