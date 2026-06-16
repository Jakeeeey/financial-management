"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";
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
    showListCost?: boolean;
    draftCosts?: Map<number, string>;
    currentCostFor?: (product: api.ProductSearchRow) => number | null;
    onDraftCostChange?: (product: api.ProductSearchRow, value: string) => void;
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
    showListCost = false,
    draftCosts,
    currentCostFor,
    onDraftCostChange,
}: Props) {
    const handlePasteCell = React.useCallback(
        (row: number, col: number, value: string) => {
            const product = products[row];
            if (!product) return;

            if (showListCost && col === 0) {
                onDraftCostChange?.(product, value);
                return;
            }

            const priceType = priceTypes[showListCost ? col - 1 : col];
            if (!priceType) return;
            onDraftPriceChange(product, priceType.price_type_id, value);
        },
        [onDraftCostChange, onDraftPriceChange, priceTypes, products, showListCost],
    );

    return (
        <div className="max-h-[46vh] overflow-y-auto rounded-md border">
            <div className="sticky top-0 z-10 border-b bg-background px-3 py-2 text-xs font-medium text-muted-foreground">
                Products and proposed prices
            </div>
            <div className="divide-y">
                {products.map((product, rowIndex) => {
                    const groupId = groupIdFor(product);

                    return (
                        <div key={product.product_id} className="space-y-3 px-3 py-3">
                            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                                <div className="min-w-0">
                                    <div className="truncate text-sm font-medium" title={product.product_name}>
                                        {product.product_name}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                        <span>Product #{product.product_id}</span>
                                        <span>Code: {product.product_code || "-"}</span>
                                        <span>Barcode: {product.barcode || "-"}</span>
                                    </div>
                                </div>
                                <span
                                    className={cn(
                                        "w-fit shrink-0 rounded-md border px-2 py-1 text-xs",
                                        isChildVariant(product)
                                            ? "bg-muted text-muted-foreground"
                                            : "bg-background text-foreground",
                                    )}
                                >
                                    {isChildVariant(product) ? `Child ${groupId}` : "Parent"}
                                </span>
                            </div>

                            <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2">
                                {showListCost ? (
                                    <div className="min-w-0 rounded-md border bg-background p-2">
                                        <div className="mb-1 flex min-w-0 items-center justify-between gap-2">
                                            <div className="truncate text-xs font-medium" title="List Cost">
                                                List Cost
                                            </div>
                                            <div className="shrink-0 text-[11px] text-muted-foreground">
                                                {formatMoney(currentCostFor?.(product) ?? null)}
                                            </div>
                                        </div>
                                        <Input
                                            inputMode="decimal"
                                            value={draftCosts?.get(product.product_id) ?? ""}
                                            onChange={(event) =>
                                                onDraftCostChange?.(product, event.target.value)
                                            }
                                            onKeyDown={(event) => gridNav.onKeyDown(event, rowIndex, 0)}
                                            onPaste={(event) =>
                                                gridNav.onPaste(event, rowIndex, 0, handlePasteCell)
                                            }
                                            onFocus={() => gridNav.setActive(rowIndex, 0)}
                                            ref={(el) => gridNav.register(rowIndex, 0, el)}
                                            placeholder="Proposed"
                                            aria-label={`Proposed list cost, row ${rowIndex + 1}`}
                                            aria-invalid={Boolean(
                                                (draftCosts?.get(product.product_id) ?? "").trim() &&
                                                    parsePriceInput(
                                                        draftCosts?.get(product.product_id) ?? "",
                                                    ).error,
                                            )}
                                            disabled={saving}
                                            className="h-8 text-right text-sm"
                                        />
                                        {(draftCosts?.get(product.product_id) ?? "").trim() &&
                                        parsePriceInput(draftCosts?.get(product.product_id) ?? "").error ? (
                                            <div className="mt-1 text-[11px] text-destructive">
                                                {
                                                    parsePriceInput(
                                                        draftCosts?.get(product.product_id) ?? "",
                                                    ).error
                                                }
                                            </div>
                                        ) : null}
                                    </div>
                                ) : null}

                                {priceTypes.map((priceType, colIndex) => {
                                    const gridColIndex = showListCost ? colIndex + 1 : colIndex;
                                    const key = cellKey(product.product_id, priceType.price_type_id);
                                    const rawValue = draftPrices.get(key) ?? "";
                                    const parsed = parsePriceInput(rawValue);
                                    const hasError = rawValue.trim() && parsed.error;
                                    const label = priceTypeLabel(priceType);

                                    return (
                                        <div key={key} className="min-w-0 rounded-md border bg-background p-2">
                                            <div className="mb-1 flex min-w-0 items-center justify-between gap-2">
                                                <div className="truncate text-xs font-medium" title={label}>
                                                    {label}
                                                </div>
                                                <div className="shrink-0 text-[11px] text-muted-foreground">
                                                    {formatMoney(currentPriceFor(product, priceType))}
                                                </div>
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
                                                    gridNav.onKeyDown(event, rowIndex, gridColIndex)
                                                }
                                                onPaste={(event) =>
                                                    gridNav.onPaste(
                                                        event,
                                                        rowIndex,
                                                        gridColIndex,
                                                        handlePasteCell,
                                                    )
                                                }
                                                onFocus={() => gridNav.setActive(rowIndex, gridColIndex)}
                                                ref={(el) => gridNav.register(rowIndex, gridColIndex, el)}
                                                placeholder="Proposed"
                                                aria-label={`Proposed price, row ${rowIndex + 1}, ${label}`}
                                                aria-invalid={Boolean(hasError)}
                                                disabled={saving}
                                                className="h-8 text-right text-sm"
                                            />
                                            {hasError ? (
                                                <div className="mt-1 text-[11px] text-destructive">{parsed.error}</div>
                                            ) : null}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
