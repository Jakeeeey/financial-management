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

export default function PriceCell(props: Props) {
    const { value, pendingValue, dirty, error, onChange } = props;

    // For display in formatPHP, we need a number. 
    // If it's a string, we parse it. If empty/invalid, we use null.
    const numericValue = React.useMemo(() => {
        if (value === null || value === "") return null;
        if (typeof value === "number") return value;
        const parsed = parseFloat(value);
        return isNaN(parsed) ? null : parsed;
    }, [value]);

    return (
        <div className="flex flex-col justify-center gap-0.5">
            <Input
                inputMode="decimal"
                value={value === null ? "" : String(value)}
                onChange={(e) => onChange(e.target.value)}
                placeholder="—"
                className={cn(
                    "h-8 text-xs",
                    dirty ? "ring-1 ring-primary/50" : "",
                    error ? "ring-1 ring-destructive" : ""
                )}
            />
            <div className="flex flex-col gap-0.5 px-0.5">
                <div className="truncate text-[10px] leading-tight text-muted-foreground font-medium">
                    {error ? (
                        <span className="text-destructive">{error}</span>
                    ) : (
                        formatPHP(numericValue)
                    )}
                </div>
                {pendingValue !== null && pendingValue !== undefined && (
                    <div className="truncate text-[10px] leading-tight text-amber-600 dark:text-amber-500 font-semibold bg-amber-50 dark:bg-amber-950/30 px-1 rounded-sm w-fit border border-amber-200/50 dark:border-amber-800/50">
                        Request: {formatPHP(pendingValue)}
                    </div>
                )}
            </div>
        </div>
    );
}