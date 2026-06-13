// src/modules/supply-chain-management/product-pricing-management/product-pricing/components/PriceCell.tsx
"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatPHP } from "../utils/format";

type Props = {
    value: number | string | null;
    pendingValue?: number | null;
    dirty: boolean;
    error: string | null;
    onChange: (raw: string) => void;
};

const PENDING_EDIT_MESSAGE = "A price change request is pending approval for this cell.";

function PriceCell(props: Props) {
    const { value, pendingValue, dirty, error, onChange } = props;
    const hasPending = pendingValue !== null && pendingValue !== undefined;

    // For display in formatPHP, we need a number. 
    // If it's a string, we parse it. If empty/invalid, we use null.
    const numericValue = React.useMemo(() => {
        if (value === null || value === "") return null;
        if (typeof value === "number") return value;
        const parsed = parseFloat(value);
        return isNaN(parsed) ? null : parsed;
    }, [value]);

    return (
        <div className="flex min-w-0 flex-col justify-center gap-0.5">
            <Input
                inputMode="decimal"
                value={value === null ? "" : String(value)}
                onChange={(e) => {
                    if (hasPending) return;
                    onChange(e.target.value);
                }}
                placeholder="—"
                disabled={hasPending}
                title={hasPending ? PENDING_EDIT_MESSAGE : undefined}
                aria-describedby={hasPending ? "price-cell-pending-hint" : undefined}
                className={cn(
                    "h-7 px-2 text-xs",
                    hasPending ? "cursor-not-allowed opacity-60" : "",
                    dirty ? "ring-1 ring-primary/50" : "",
                    error ? "ring-1 ring-destructive" : ""
                )}
            />
            <div className="flex min-w-0 flex-col gap-0.5 px-0.5">
                <div className="truncate text-[10px] leading-none text-muted-foreground font-medium">
                    {error ? (
                        <span className="text-destructive">{error}</span>
                    ) : (
                        formatPHP(numericValue)
                    )}
                </div>
                {hasPending ? (
                    <div
                        id="price-cell-pending-hint"
                        title={`Request: ${formatPHP(pendingValue)} — pending approval`}
                        className="max-w-full truncate text-[10px] leading-snug text-amber-600 dark:text-amber-500 font-semibold bg-amber-50 dark:bg-amber-950/30 px-1 py-0.5 rounded-sm border border-amber-200/50 dark:border-amber-800/50"
                    >
                        Pending {formatPHP(pendingValue)}
                    </div>
                ) : null}
            </div>
        </div>
    );
}

export default React.memo(PriceCell);
