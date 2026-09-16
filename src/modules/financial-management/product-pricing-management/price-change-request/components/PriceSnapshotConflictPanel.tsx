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
import { createPriceChangeBatch } from "../providers/pcrApi";

export type ConflictLabel = {
    product_name?: string;
    product_code?: string;
    price_type_name?: string;
    unit_name?: string | null;
};

type Props = {
    conflicts: PriceSnapshotConflict[];
    supplierId: number | null;
    supplierName: string;
    batchLabel: string;
    labels?: Record<string, ConflictLabel>;
    onCreated?: () => void;
};

function conflictKey(conflict: PriceSnapshotConflict) {
    return `${conflict.product_id}:${conflict.price_type_id}`;
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
    const label = labels[`${productId}:${priceTypeId}`];
    const productName = label?.product_name || `Product #${productId}`;
    const priceTypeName = label?.price_type_name || `Price Type #${priceTypeId}`;
    const unitLabel = label?.unit_name ? `, UOM ${label.unit_name}` : "";

    return `Price changed after submission for ${productName}, price type ${priceTypeName}${unitLabel}.`;
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
    supplierId,
    supplierName,
    batchLabel,
    labels = {},
    onCreated,
}: Props) {
    const [selectedConflict, setSelectedConflict] = React.useState<PriceSnapshotConflict | null>(null);
    const [saving, setSaving] = React.useState(false);

    const selectedLabel = selectedConflict ? labels[conflictKey(selectedConflict)] : undefined;

    async function createReplacement() {
        if (!selectedConflict || !supplierId || saving) return;
        if (selectedConflict.proposed_price === null || !Number.isFinite(Number(selectedConflict.proposed_price))) {
            toast.error("The original proposed price is invalid; create a new request manually.");
            return;
        }

        setSaving(true);
        try {
            const result = await createPriceChangeBatch({
                supplier_id: supplierId,
                reference_no: `${batchLabel}-REPLACEMENT-${selectedConflict.request_id}`,
                remarks: `Replacement for ${batchLabel} after a price snapshot conflict. The latest live price was used as the new snapshot.`,
                lines: [
                    {
                        product_id: selectedConflict.product_id,
                        price_type_id: selectedConflict.price_type_id,
                        current_price: selectedConflict.live_price,
                        proposed_price: selectedConflict.proposed_price,
                    },
                ],
            });

            if (Number(result.created ?? 0) > 0) {
                toast.success("Replacement price-change request created.");
                onCreated?.();
            } else {
                toast.info("A replacement request was not created because the line is already pending.");
            }
            setSelectedConflict(null);
        } catch (error: unknown) {
            toast.error(error instanceof Error ? error.message : "Failed to create replacement request.");
        } finally {
            setSaving(false);
        }
    }

    if (conflicts.length === 0) return null;

    return (
        <>
            <Alert variant="destructive">
                <AlertTitle>Price snapshot conflict</AlertTitle>
                <AlertDescription>
                    These lines were not overwritten because the live price changed after submission. Review the latest
                    value and create a replacement request if the proposed price is still required.
                </AlertDescription>
                <div className="col-start-2 mt-3 w-full min-w-0 space-y-2">
                    {conflicts.map((conflict) => {
                        const label = labels[conflictKey(conflict)];
                        return (
                            <div
                                key={`${conflict.request_id}-${conflictKey(conflict)}`}
                                className="flex flex-col gap-2 rounded-md border border-destructive/30 bg-background/70 p-3 sm:flex-row sm:items-center sm:justify-between"
                            >
                                <div className="min-w-0 flex-1 text-sm">
                                    <div className="break-words font-medium leading-snug">
                                            {label?.product_name || `Product #${conflict.product_id}`}
                                            {label?.product_code ? ` (${label.product_code})` : ""}
                                        </div>
                                    {label?.unit_name ? (
                                        <div className="mt-1 text-xs text-muted-foreground">UOM: {label.unit_name}</div>
                                    ) : null}
                                    <div className="mt-2 grid gap-2 text-sm sm:grid-cols-4">
                                        <div className="min-w-0 rounded border bg-muted/30 px-2 py-1.5">
                                            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                                Price Type
                                            </div>
                                            <div className="mt-0.5 break-words font-medium">
                                                {label?.price_type_name || `Price Type #${conflict.price_type_id}`}
                                            </div>
                                        </div>
                                        <div className="rounded border bg-muted/30 px-2 py-1.5">
                                            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                                Submitted
                                            </div>
                                            <div className="mt-0.5 font-medium">{money(conflict.snapshot_price)}</div>
                                        </div>
                                        <div className="min-w-0 rounded border bg-muted/30 px-2 py-1.5">
                                            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                                Live
                                            </div>
                                            <div className="mt-0.5 break-words font-medium">{money(conflict.live_price)}</div>
                                        </div>
                                        <div className="min-w-0 rounded border bg-muted/30 px-2 py-1.5">
                                            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                                Proposed
                                            </div>
                                            <div className="mt-0.5 break-words font-medium">
                                                {money(conflict.proposed_price)}
                                            </div>
                                        </div>
                                   </div>
                                </div>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setSelectedConflict(conflict)}
                                    disabled={!supplierId || saving}
                                >
                                    Create Replacement Request
                                </Button>
                            </div>
                        );
                    })}
                </div>
                {!supplierId ? (
                    <p className="col-start-2 mt-2 text-xs">A supplier is required before a replacement request can be created.</p>
                ) : null}
            </Alert>

            <Dialog
                open={selectedConflict !== null}
                onOpenChange={(open) => {
                    if (!open && !saving) setSelectedConflict(null);
                }}
            >
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Create Replacement Request</DialogTitle>
                        <DialogDescription>
                            This creates a new pending request and leaves the original approved/failed line unchanged.
                        </DialogDescription>
                    </DialogHeader>

                    {selectedConflict ? (
                        <div className="space-y-3 text-sm">
                            <div className="rounded-md border bg-muted/30 p-3">
                                <div className="font-medium">
                                    {selectedLabel?.product_name || `Product #${selectedConflict.product_id}`}
                                    {selectedLabel?.product_code ? ` (${selectedLabel.product_code})` : ""}
                                </div>
                                <div className="text-muted-foreground">
                                    {selectedLabel?.price_type_name || `Price Type #${selectedConflict.price_type_id}`}
                                </div>
                                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                                    <div>
                                        <div className="text-xs text-muted-foreground">Supplier</div>
                                        <div className="font-medium">{supplierName || `Supplier #${supplierId}`}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-muted-foreground">Latest live</div>
                                        <div className="font-medium">{money(selectedConflict.live_price)}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-muted-foreground">Old snapshot</div>
                                        <div className="font-medium">{money(selectedConflict.snapshot_price)}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-muted-foreground">Proposed</div>
                                        <div className="font-medium">{money(selectedConflict.proposed_price)}</div>
                                    </div>
                                </div>
                            </div>
                            <p className="text-muted-foreground">
                                The new request will snapshot the latest live price ({money(selectedConflict.live_price)})
                                and retain the original proposal ({money(selectedConflict.proposed_price)}).
                            </p>
                        </div>
                    ) : null}

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setSelectedConflict(null)} disabled={saving}>
                            Cancel
                        </Button>
                        <Button type="button" onClick={() => void createReplacement()} disabled={saving || !supplierId}>
                            {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                            Create Request
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
