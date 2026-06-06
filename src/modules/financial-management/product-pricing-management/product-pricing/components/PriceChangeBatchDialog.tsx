"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Textarea } from "@/components/ui/textarea";

import type { Supplier } from "../types";

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    suppliers: Supplier[];
    defaultSupplierId: number | null;
    priceLineCount: number;
    costLineCount: number;
    onSubmit: (payload: { supplier_id: number; reference_no?: string; remarks: string }) => Promise<void>;
};

function supplierLabel(supplier: Supplier) {
    const shortcut = String(supplier.supplier_shortcut ?? "").trim();
    const name = String(supplier.supplier_name ?? "").trim();
    return shortcut && name ? `${shortcut} - ${name}` : name || `Supplier #${supplier.id}`;
}

export function PriceChangeBatchDialog({
    open,
    onOpenChange,
    suppliers,
    defaultSupplierId,
    priceLineCount,
    costLineCount,
    onSubmit,
}: Props) {
    const [supplierId, setSupplierId] = React.useState(defaultSupplierId ? String(defaultSupplierId) : "");
    const [referenceNo, setReferenceNo] = React.useState("");
    const [remarks, setRemarks] = React.useState("");
    const [submitting, setSubmitting] = React.useState(false);

    React.useEffect(() => {
        if (!open) return;
        setSupplierId(defaultSupplierId ? String(defaultSupplierId) : "");
        setReferenceNo("");
        setRemarks("");
    }, [defaultSupplierId, open]);

    async function submit() {
        const parsedSupplierId = Number(supplierId);
        if (!Number.isFinite(parsedSupplierId) || parsedSupplierId <= 0) return;
        if (!remarks.trim()) return;

        setSubmitting(true);
        try {
            await onSubmit({
                supplier_id: parsedSupplierId,
                reference_no: referenceNo.trim() || undefined,
                remarks: remarks.trim(),
            });
            onOpenChange(false);
        } finally {
            setSubmitting(false);
        }
    }

    const canSubmit = Number(supplierId) > 0 && remarks.trim().length > 0 && !submitting;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>New Price Change Batch</DialogTitle>
                    <DialogDescription>
                        Group the pending price edits into one document for approval.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-4">
                    <div className="grid gap-3 rounded-md border bg-muted/30 p-3 text-sm sm:grid-cols-2">
                        <div>
                            <div className="text-xs font-medium uppercase text-muted-foreground">Price Lines</div>
                            <div className="mt-1 text-lg font-semibold">{priceLineCount}</div>
                        </div>
                        <div>
                            <div className="text-xs font-medium uppercase text-muted-foreground">List Cost Lines</div>
                            <div className="mt-1 text-lg font-semibold">{costLineCount}</div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <Label>Supplier</Label>
                        <SearchableSelect
                            value={supplierId}
                            onValueChange={setSupplierId}
                            placeholder="Select supplier"
                            options={suppliers.map((supplier) => ({
                                value: String(supplier.id),
                                label: supplierLabel(supplier),
                            }))}
                        />
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="price-change-reference">Reference No.</Label>
                        <Input
                            id="price-change-reference"
                            value={referenceNo}
                            onChange={(event) => setReferenceNo(event.target.value)}
                            placeholder="Optional supplier quote or memo reference"
                        />
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="price-change-remarks">Remarks</Label>
                        <Textarea
                            id="price-change-remarks"
                            value={remarks}
                            onChange={(event) => setRemarks(event.target.value)}
                            placeholder="Explain why this batch should be approved"
                            className="min-h-24 resize-y"
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
                        Cancel
                    </Button>
                    <Button onClick={() => void submit()} disabled={!canSubmit}>
                        {submitting && <Loader2 className="mr-2 size-4 animate-spin" />}
                        Submit Batch
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
