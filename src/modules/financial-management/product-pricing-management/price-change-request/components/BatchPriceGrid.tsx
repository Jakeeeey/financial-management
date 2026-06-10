"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

import * as api from "../providers/pcrApi";
import { useEditableGridNavigation } from "./useEditableGridNavigation";

type GridNav = ReturnType<typeof useEditableGridNavigation>;

type Props = {
    products: api.ProductSearchRow[];
    priceTypes: api.PriceTypeOption[];
    draftPrices: Map<string, string>;
    saving: boolean;
    gridNav: GridNav;
    cellKey: (productId: number, priceTypeId: number) => string;
    formatMoney: (value: number | null | undefined) => string;
    priceTypeLabel: (priceType: api.PriceTypeOption) => string;
    currentPriceFor: (product: api.ProductSearchRow, priceType: api.PriceTypeOption) => number | null;
    parsePriceInput: (value: string) => { value: number | null; error: string | null };
    groupIdFor: (product: api.ProductSearchRow) => number;
    isChildVariant: (product: api.ProductSearchRow) => boolean;
    onDraftPriceChange: (product: api.ProductSearchRow, priceTypeId: number, value: string) => void;
};

export function BatchPriceGrid({
    products,
    priceTypes,
    draftPrices,
    saving,
    gridNav,
    cellKey,
    formatMoney,
    priceTypeLabel,
    currentPriceFor,
    parsePriceInput,
    groupIdFor,
    isChildVariant,
    onDraftPriceChange,
}: Props) {
    const handlePasteCell = React.useCallback(
        (row: number, col: number, value: string) => {
            const product = products[row];
            const priceType = priceTypes[col];
            if (!product || !priceType) return;
            onDraftPriceChange(product, priceType.price_type_id, value);
        },
        [onDraftPriceChange, priceTypes, products],
    );

    return (
        <div className="max-h-[46vh] overflow-auto">
            <Table>
                <TableHeader className="sticky top-0 z-10 bg-background">
                    <TableRow>
                        <TableHead className="min-w-[270px]">Product</TableHead>
                        <TableHead className="min-w-[140px]">Code / Barcode</TableHead>
                        <TableHead className="min-w-[90px]">Group</TableHead>
                        {priceTypes.map((priceType) => (
                            <TableHead
                                key={priceType.price_type_id}
                                className="min-w-[150px] text-right"
                            >
                                {priceTypeLabel(priceType)}
                            </TableHead>
                        ))}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {products.map((product, rowIndex) => {
                        const groupId = groupIdFor(product);

                        return (
                            <TableRow key={product.product_id}>
                                <TableCell className="max-w-[320px] whitespace-normal">
                                    <div className="font-medium">{product.product_name}</div>
                                    <div className="text-xs text-muted-foreground">
                                        Product #{product.product_id}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div>{product.product_code || "-"}</div>
                                    <div className="text-xs text-muted-foreground">{product.barcode || "-"}</div>
                                </TableCell>
                                <TableCell>
                                    <span
                                        className={cn(
                                            "rounded-md border px-2 py-1 text-xs",
                                            isChildVariant(product)
                                                ? "bg-muted text-muted-foreground"
                                                : "bg-background text-foreground",
                                        )}
                                    >
                                        {isChildVariant(product) ? `Child ${groupId}` : "Parent"}
                                    </span>
                                </TableCell>
                                {priceTypes.map((priceType, colIndex) => {
                                    const key = cellKey(product.product_id, priceType.price_type_id);
                                    const rawValue = draftPrices.get(key) ?? "";
                                    const parsed = parsePriceInput(rawValue);
                                    const hasError = rawValue.trim() && parsed.error;
                                    const label = priceTypeLabel(priceType);

                                    return (
                                        <TableCell key={key} className="text-right">
                                            <div className="flex min-w-[130px] flex-col gap-1">
                                                <div className="text-[11px] text-muted-foreground">
                                                    Current {formatMoney(currentPriceFor(product, priceType))}
                                                </div>
                                                <Input
                                                    inputMode="decimal"
                                                    value={rawValue}
                                                    onChange={(event) =>
                                                        onDraftPriceChange(
                                                            product,
                                                            priceType.price_type_id,
                                                            event.target.value,
                                                        )
                                                    }
                                                    onKeyDown={(event) =>
                                                        gridNav.onKeyDown(event, rowIndex, colIndex)
                                                    }
                                                    onPaste={(event) =>
                                                        gridNav.onPaste(event, rowIndex, colIndex, handlePasteCell)
                                                    }
                                                    onFocus={() => gridNav.setActive(rowIndex, colIndex)}
                                                    ref={(el) => gridNav.register(rowIndex, colIndex, el)}
                                                    placeholder="Proposed"
                                                    aria-label={`Proposed price, row ${rowIndex + 1}, ${label}`}
                                                    aria-invalid={Boolean(hasError)}
                                                    disabled={saving}
                                                    className="h-8 text-right text-sm"
                                                />
                                                {hasError ? (
                                                    <div className="text-[11px] text-destructive">{parsed.error}</div>
                                                ) : null}
                                            </div>
                                        </TableCell>
                                    );
                                })}
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </div>
    );
}
