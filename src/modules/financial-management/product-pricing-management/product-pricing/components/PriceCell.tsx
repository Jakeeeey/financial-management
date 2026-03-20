// src/modules/supply-chain-management/product-pricing-management/product-pricing/components/PriceCell.tsx
"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatPHP } from "../utils/format";

type Props = {
    value: number | null;
    dirty: boolean;
    error: string | null;
    onChange: (raw: string) => void;
};

export default function PriceCell(props: Props) {
    const { value, dirty, error, onChange } = props;

    return (
        <div className="flex h-12 flex-col justify-center gap-1">
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
            <div className="truncate text-[10px] leading-none text-muted-foreground">
                {error ? <span className="text-destructive">{error}</span> : formatPHP(value)}
            </div>
        </div>
    );
}