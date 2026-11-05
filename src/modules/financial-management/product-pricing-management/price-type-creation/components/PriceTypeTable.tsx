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
import { Edit2, Trash2 } from "lucide-react";
import type { PriceType } from "../../product-pricing/types";

interface PriceTypeTableProps {
    priceTypes: PriceType[];
    onEdit: (pt: PriceType) => void;
    onDelete: (pt: PriceType) => void;
    onToggleActive: (pt: PriceType) => void;
}

export function PriceTypeTable({ priceTypes, onEdit, onDelete, onToggleActive }: PriceTypeTableProps) {
    return (
        <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
            <Table>
                <TableHeader>
                    <TableRow className="bg-muted/50">
                        <TableHead className="w-[100px]">ID</TableHead>
                        <TableHead>Price Type Name</TableHead>
                        <TableHead>Sort Order</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {priceTypes.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                No price types found.
                            </TableCell>
                        </TableRow>
                    ) : (
                        priceTypes.map((pt) => {
                            const isActive = pt.is_active == null || pt.is_active === true || pt.is_active === 1 || pt.is_active === "1";
                            return (
                                <TableRow key={pt.price_type_id} className="hover:bg-muted/30 transition-colors">
                                    <TableCell className="font-mono text-xs">{pt.price_type_id}</TableCell>
                                    <TableCell className="font-medium text-primary">{pt.price_type_name}</TableCell>
                                    <TableCell>{pt.sort ?? "—"}</TableCell>
                                    <TableCell>{isActive ? "Active" : "Inactive"}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => onToggleActive(pt)}
                                            >
                                                {isActive ? "Deactivate" : "Reactivate"}
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                aria-label={`Edit ${pt.price_type_name}`}
                                                onClick={() => onEdit(pt)}
                                                className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
                                            >
                                                <Edit2 className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                aria-label={`Delete ${pt.price_type_name}`}
                                                onClick={() => onDelete(pt)}
                                                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
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
