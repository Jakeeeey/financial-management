"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

import type { PriceSnapshotConflict } from "../types";

export type ConflictLabel = {
    product_name?: string;
    product_code?: string;
    price_type_name?: string;
    unit_name?: string | null;
};

type Props = {
    conflicts: PriceSnapshotConflict[];
    recordLabel?: string;
    labels?: Record<string, ConflictLabel>;
    forceApplying?: boolean;
    onForceApply?: () => Promise<void> | void;
};

function conflictKey(conflict: PriceSnapshotConflict) {
    return String(conflict.product_id) + ":" + String(conflict.price_type_id);
}

export function formatPriceSnapshotConflictMessage(
    message: string | null | undefined,
    labels: Record<string, ConflictLabel>,
) {
    if (!message) return message;

    const match = message.match(/price changed after submission for product (\d+), price type (\d+)\./i);
    if (!match) return message;

    const productId = Number(match[1]);
    const priceTypeId = Number(match[2]);
    const label = labels[String(productId) + ":" + String(priceTypeId)];
    const productName = label?.product_name || "Product #" + String(productId);
    const priceTypeName = label?.price_type_name || "Price Type #" + String(priceTypeId);
    const unitLabel = label?.unit_name ? ", UOM " + label.unit_name : "";

    return "Price changed after submission for " + productName + ", price type " + priceTypeName + unitLabel + ".";
}

function money(value: number | null | undefined) {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) return "-";
    return new Intl.NumberFormat("en-PH", {
        style: "currency",
        currency: "PHP",
        minimumFractionDigits: 2,
        maximumFractionDigits: 4,
    }).format(Number(value));
}

export function PriceSnapshotConflictPanel({
    conflicts,
    recordLabel = "this price change batch",
    labels = {},
    forceApplying = false,
    onForceApply,
}: Props) {
    const [confirming, setConfirming] = React.useState(false);

    async function forceApply() {
        if (!onForceApply || forceApplying) return;

        try {
            await onForceApply();
            setConfirming(false);
        } catch (error: unknown) {
            toast.error(error instanceof Error ? error.message : "Failed to force apply the price change.");
        }
    }

    if (conflicts.length === 0) return null;

    return (
        <>
            <Alert variant="destructive">
                <AlertTitle>Price snapshot conflict</AlertTitle>
                <AlertDescription>
                    These lines were not applied because the live price changed after submission. Review the latest and
                    proposed values. Force Apply &amp; Approve applies the entire PCB immediately and overrides the snapshot check.
                </AlertDescription>
                <div className="col-start-2 mt-3 w-full min-w-0 space-y-2">
                    {conflicts.map((conflict) => {
                        const label = labels[conflictKey(conflict)];
                        return (
                            <div
                                key={String(conflict.request_id) + "-" + conflictKey(conflict)}
                                className="rounded-md border border-destructive/30 bg-background/70 p-3 text-sm"
                            >
                                <div className="break-words font-medium leading-snug">
                                    {label?.product_name || "Product #" + String(conflict.product_id)}
                                    {label?.product_code ? " (" + label.product_code + ")" : ""}
                                </div>
                                {label?.unit_name ? (
                                    <div className="mt-1 text-xs text-muted-foreground">UOM: {label.unit_name}</div>
                                ) : null}
                                <div className="mt-2 grid gap-2 text-sm sm:grid-cols-4">
                                    <div className="min-w-0 rounded border bg-muted/30 px-2 py-1.5">
                                        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Price Type</div>
                                        <div className="mt-0.5 break-words font-medium">
                                            {label?.price_type_name || "Price Type #" + String(conflict.price_type_id)}
                                        </div>
                                    </div>
                                    <div className="rounded border bg-muted/30 px-2 py-1.5">
                                        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Submitted</div>
                                        <div className="mt-0.5 font-medium">{money(conflict.snapshot_price)}</div>
                                    </div>
                                    <div className="min-w-0 rounded border bg-muted/30 px-2 py-1.5">
                                        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Live</div>
                                        <div className="mt-0.5 break-words font-medium">{money(conflict.live_price)}</div>
                                    </div>
                                    <div className="min-w-0 rounded border bg-muted/30 px-2 py-1.5">
                                        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Proposed</div>
                                        <div className="mt-0.5 break-words font-medium">{money(conflict.proposed_price)}</div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
                {onForceApply ? (
                    <Button
                        type="button"
                        className="col-start-2 mt-3 justify-self-start"
                        variant="destructive"
                        onClick={() => setConfirming(true)}
                        disabled={forceApplying}
                    >
                        {forceApplying ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                        Force Apply &amp; Approve {recordLabel}
                    </Button>
                ) : null}
            </Alert>

            <Dialog open={confirming} onOpenChange={(open) => !forceApplying && setConfirming(open)}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Force Apply &amp; Approve {recordLabel}?</DialogTitle>
                        <DialogDescription>
                            The submitted price snapshot is stale. This action immediately approves and applies the full PCB,
                            preserves the submitted snapshot for audit, and overrides the live-price conflict check.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
                        This action affects the entire price change batch, not only the displayed conflict line. Confirm only if
                        the proposed prices are still authorized.
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setConfirming(false)} disabled={forceApplying}>
                            Cancel
                        </Button>
                        <Button type="button" variant="destructive" onClick={() => void forceApply()} disabled={forceApplying}>
                            {forceApplying ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                            Confirm Force Apply
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
