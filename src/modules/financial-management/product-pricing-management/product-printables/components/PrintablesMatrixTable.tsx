// src/modules/financial-management/printables-management/product-printables/components/PrintablesMatrixTable.tsx
"use client";

import React from "react";
import type { MatrixRow, PriceType, Unit } from "../types";
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
import { cn } from "@/lib/utils";
import { AlertCircle, RefreshCw } from "lucide-react";

type Props = {
    rows: MatrixRow[];
    loading: boolean;
    error?: string | null;
    onRetry?: () => void;
    priceTypes: PriceType[];
    units: Unit[];
    usedUnitIds: Set<number>;
    selectedPriceTypeIds?: string[];
};

export default function PrintablesMatrixTable({ 
    rows, 
    loading, 
    error,
    onRetry,
    priceTypes, 
    units, 
    usedUnitIds,
    selectedPriceTypeIds = []
}: Props) {
    if (loading) {
        return (
            <div className="overflow-hidden rounded-xl border border-[#D1D5DB]">
                <div className="min-w-[900px]">
                    <div className="grid grid-cols-[100px_100px_180px_repeat(6,minmax(70px,1fr))] gap-px border-b bg-[#D1D5DB]">
                        {Array.from({ length: 9 }).map((_, index) => (
                            <div key={`header-${index}`} className="bg-[#F9FAFB] p-3">
                                <Skeleton className="h-4 w-full" />
                            </div>
                        ))}
                    </div>
                    {Array.from({ length: 8 }).map((_, rowIndex) => (
                        <div
                            key={`row-${rowIndex}`}
                            className="grid grid-cols-[100px_100px_180px_repeat(6,minmax(70px,1fr))] gap-px border-b bg-[#E5E7EB] last:border-b-0"
                        >
                            {Array.from({ length: 9 }).map((_, columnIndex) => (
                                <div key={`cell-${columnIndex}`} className="bg-background p-3">
                                    <Skeleton
                                        className={cn(
                                            "h-4",
                                            columnIndex === 2 ? "w-4/5" : columnIndex < 3 ? "w-3/5" : "ml-auto w-2/3",
                                        )}
                                    />
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center">
                <AlertCircle className="h-6 w-6 text-destructive" />
                <div>
                    <p className="text-sm font-medium">Unable to load products</p>
                    <p className="mt-1 text-sm text-muted-foreground">{error}</p>
                </div>
                {onRetry ? (
                    <Button type="button" variant="outline" size="sm" onClick={onRetry}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Retry
                    </Button>
                ) : null}
            </div>
        );
    }

    if (rows.length === 0) return <div className="p-8 text-center text-muted-foreground">No products found.</div>;

    const visibleUnits = units.filter(u => usedUnitIds.has(Number(u.unit_id)));
    
    // Filter price types based on selection
    const activePriceTypes = priceTypes.filter(pt => {
        if (selectedPriceTypeIds.length === 0) return pt.sort != null && pt.sort <= 5; // Default to first 5
        return selectedPriceTypeIds.includes(String(pt.price_type_id));
    });

    const totalMatrixCols = activePriceTypes.length * (visibleUnits.length || 1);

    // Defined colors for groups (matching spreadsheet aesthetic)
    const groupColors = [
        "bg-[#F3F4F6] text-[#374151] border-[#D1D5DB]", // List Price (Gray)
        "bg-[#EAF4FF] text-[#1E4D8C] border-[#B8D1F3]", // Group 1 (Blue)
        "bg-[#F0FFF4] text-[#1D5C2E] border-[#C6F6D5]", // Group 2 (Green)
        "bg-[#FFF9E6] text-[#8C6D1E] border-[#FCEFB4]", // Group 3 (Yellow)
        "bg-[#FFF5F5] text-[#8C1E1E] border-[#FED7D7]", // Group 4 (Red)
        "bg-[#F7F0FF] text-[#4D1E8C] border-[#E9D8FD]", // Group 5 (Purple)
    ];

    return (
        <div className="rounded-xl border border-[#D1D5DB] overflow-hidden overflow-x-auto shadow-md">
            <Table className="border-collapse border-hidden">
                <TableHeader className="bg-[#F9FAFB]">
                    {/* Level 1: Global Header */}
                    <TableRow className="border-b border-[#D1D5DB]">
                        <TableHead colSpan={3} className="border-r border-[#D1D5DB] sticky left-0 top-0 z-40 bg-[#F9FAFB] h-8"></TableHead>
                        <TableHead 
                            colSpan={totalMatrixCols || 1} 
                            className="text-center font-bold text-[11px] uppercase tracking-[0.2em] text-[#4B5563] py-1 border-r border-[#D1D5DB] sticky top-0 z-30 bg-[#F9FAFB]"
                        >
                            Price Type
                        </TableHead>
                    </TableRow>
                    
                    {/* Level 2: Price Tiers (Selected) */}
                    <TableRow className="border-b border-[#D1D5DB]">
                        <TableHead className="font-bold sticky left-0 top-8 z-40 bg-[#F9FAFB] border-r border-[#D1D5DB] min-w-[100px] text-[10px] uppercase text-[#374151] h-10">Brand</TableHead>
                        <TableHead className="font-bold sticky left-[100px] top-8 z-40 bg-[#F9FAFB] border-r border-[#D1D5DB] min-w-[100px] text-[10px] uppercase text-[#374151] h-10">Category</TableHead>
                        <TableHead className="font-bold sticky left-[200px] top-8 z-40 bg-[#F9FAFB] border-r border-[#D1D5DB] min-w-[180px] text-[10px] uppercase text-[#374151] h-10">Product Name</TableHead>
                        {activePriceTypes.map((pt) => {
                            const absoluteIndex = priceTypes.indexOf(pt);
                            return (
                                <TableHead 
                                    key={pt.price_type_id} 
                                    colSpan={visibleUnits.length || 1} 
                                    className={cn(
                                        "text-center font-black text-xs border-r border-[#D1D5DB] py-1.5 sticky top-8 z-30",
                                        groupColors[absoluteIndex !== -1 ? absoluteIndex % groupColors.length : 0]
                                    )}
                                >
                                    {pt.price_type_name}
                                </TableHead>
                            );
                        })}
                    </TableRow>

                    {/* Level 3: Units (BOX, PCS, etc.) */}
                    <TableRow className="border-b border-[#D1D5DB]">
                        <TableHead className="sticky left-0 top-[72px] z-40 bg-[#F9FAFB] border-r border-[#D1D5DB] h-8"></TableHead>
                        <TableHead className="sticky left-[100px] top-[72px] z-40 bg-[#F9FAFB] border-r border-[#D1D5DB] h-8"></TableHead>
                        <TableHead className="sticky left-[200px] top-[72px] z-40 bg-[#F9FAFB] border-r border-[#D1D5DB] h-8"></TableHead>
                        {activePriceTypes.map((pt) => (
                            <React.Fragment key={pt.price_type_id}>
                                {visibleUnits.length > 0 ? visibleUnits.map((u) => (
                                    <TableHead 
                                        key={u.unit_id} 
                                        className="text-center font-bold text-[9px] uppercase text-[#6B7280] py-1 border-r border-[#E5E7EB] min-w-[70px] sticky top-[72px] z-30 bg-[#F9FAFB]"
                                    >
                                        {u.unit_shortcut}
                                    </TableHead>
                                )) : (
                                    <TableHead className="min-w-[70px] border-r border-[#E5E7EB]">—</TableHead>
                                )}
                            </React.Fragment>
                        ))}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {rows.map((row) => (
                        <TableRow key={row.group_id} className="hover:bg-[#F3F4F6] transition-colors border-b border-[#E5E7EB]">
                            <TableCell className="sticky left-0 bg-white z-10 border-r border-[#D1D5DB] py-2 text-[10px] text-[#4B5563]">
                                {row.brand_name}
                            </TableCell>
                            <TableCell className="sticky left-[100px] bg-white z-10 border-r border-[#D1D5DB] py-2 text-[10px] text-[#4B5563]">
                                {row.category_name}
                            </TableCell>
                            <TableCell className="font-semibold sticky left-[200px] bg-white z-10 border-r border-[#D1D5DB] py-2 text-[11px] text-[#111827]">
                                {row.display.product_name}
                            </TableCell>
                            {activePriceTypes.map((pt) => {
                                const ptSuffix = pt.price_type_id === -1 ? "LIST" : String(pt.price_type_id);
                                
                                return (
                                    <React.Fragment key={pt.price_type_id}>
                                        {visibleUnits.length > 0 ? visibleUnits.map((u) => {
                                            const variant = row.variantsByUnitId[Number(u.unit_id)];
                                            const price = (variant?.tiers as Record<string, number | null>)?.[ptSuffix];

                                            return (
                                                <TableCell 
                                                    key={u.unit_id} 
                                                    className={cn(
                                                        "text-right border-r border-[#E5E7EB] px-3 py-2 font-mono text-[10px]",
                                                        price == null ? "bg-[#F9FAFB]/50" : ""
                                                    )}
                                                >
                                                    {price != null ? (
                                                        <span className="font-bold text-[#374151]">
                                                            {price.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                                                        </span>
                                                    ) : (
                                                        <span className="text-[#D1D5DB]">—</span>
                                                    )}
                                                </TableCell>
                                            );
                                        }) : (
                                            <TableCell className="border-r border-[#E5E7EB] bg-[#F9FAFB]/50">—</TableCell>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
