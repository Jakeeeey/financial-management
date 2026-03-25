// src/modules/supply-chain-management/product-pricing-management/product-pricing/components/BulkSaveBar.tsx
"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Printer, RotateCcw, RefreshCw, Save } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
    dirtyCount: number;
    loading: boolean;

    onSave: () => void;
    onDiscard: () => void;
    onRefresh: () => void;
    onPrint: () => void;

    // ✅ new: show what will be printed (based on current filters)
    filtersText?: string;
};

export default function BulkSaveBar(props: Props) {
    const { dirtyCount, loading, onSave, onDiscard, onRefresh, onPrint } = props;

    const hasDirty = dirtyCount > 0;

    return (
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            {/* Left: Printables + status (matches “pill / tight” feel) */}
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
                <Card className="w-full rounded-2xl border p-3 shadow-sm sm:w-auto">
                    <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                            <div className="text-sm font-semibold leading-tight">Printables</div>
                            <div className="text-xs text-muted-foreground leading-tight">Pricing Matrix (PDF)</div>

                        </div>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onPrint}
                            disabled={loading}
                            className={cn("gap-2", "cursor-pointer")}
                            type="button"
                        >
                            <Printer className="h-4 w-4" />
                            Print
                        </Button>
                    </div>
                </Card>

                <div className="flex items-center gap-2">
                    <Badge variant={hasDirty ? "default" : "secondary"}>
                        {dirtyCount} change{dirtyCount === 1 ? "" : "s"}
                    </Badge>
                    {loading ? <span className="text-sm text-muted-foreground">Loading…</span> : null}
                </div>
            </div>

            {/* Right: Actions */}
            <div className="flex w-full flex-wrap items-center justify-end gap-2 lg:w-auto">
                <Button
                    variant="outline"
                    onClick={onRefresh}
                    disabled={loading}
                    className="gap-2 cursor-pointer"
                    type="button"
                >
                    <RefreshCw className="h-4 w-4" />
                    Refresh
                </Button>

                <Button
                    variant="outline"
                    onClick={onDiscard}
                    disabled={!hasDirty}
                    className="gap-2 cursor-pointer"
                    type="button"
                >
                    <RotateCcw className="h-4 w-4" />
                    Discard
                </Button>

                <Button
                    onClick={onSave}
                    disabled={!hasDirty}
                    className="gap-2 cursor-pointer"
                    type="button"
                >
                    <Save className="h-4 w-4" />
                    Save
                </Button>
            </div>
        </div>
    );
}
