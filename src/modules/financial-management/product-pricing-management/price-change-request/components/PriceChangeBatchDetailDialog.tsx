"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

import type { PriceChangeBatchDetail, PriceChangeBatchLine } from "../types";
import { getPriceChangeBatch } from "../providers/pcrApi";
import { pcrStatusBadgeClass } from "../utils/pcrStatusStyles";

type Props = {
    batchId: number | null;
    open: boolean;
    acting: boolean;
    onOpenChange: (open: boolean) => void;
    onApprove: (headerId: number) => Promise<void> | void;
    onReject: (headerId: number) => void;
};

function money(value: number | null | undefined) {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) return "-";
    return Number(value).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function percent(value: number | null | undefined) {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) return "-";
    return `${Number(value).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

function safeDate(value: string | null | undefined) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
}

function diffClass(line: PriceChangeBatchLine) {
    const delta = Number(line.delta ?? 0);
    if (delta > 0) return "text-destructive";
    if (delta < 0) return "text-emerald-600";
    return "text-muted-foreground";
}

function total(lines: PriceChangeBatchLine[], field: "current_price" | "proposed_price") {
    return lines.reduce((sum, line) => {
        const value = Number(line[field]);
        return Number.isFinite(value) ? sum + value : sum;
    }, 0);
}

export function PriceChangeBatchDetailDialog({
    batchId,
    open,
    acting,
    onOpenChange,
    onApprove,
    onReject,
}: Props) {
    const [detail, setDetail] = React.useState<PriceChangeBatchDetail | null>(null);
    const [loading, setLoading] = React.useState(false);

    React.useEffect(() => {
        let cancelled = false;

        async function load() {
            if (!open || !batchId) {
                setDetail(null);
                return;
            }

            setLoading(true);
            try {
                const result = await getPriceChangeBatch(batchId);
                if (!cancelled) setDetail(result.data);
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : "Failed to load batch detail";
                if (!cancelled) toast.error(message);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        void load();

        return () => {
            cancelled = true;
        };
    }, [batchId, open]);

    const lines = detail?.details ?? [];
    const isPending = detail?.status === "PENDING";
    const currentTotal = total(lines, "current_price");
    const proposedTotal = total(lines, "proposed_price");
    const headerId = detail?.header_id ?? batchId ?? 0;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-5xl">
                <DialogHeader>
                    <DialogTitle>Price Change Batch {headerId ? `PCB-${headerId}` : ""}</DialogTitle>
                    <DialogDescription>
                        Review the current and proposed prices before approving the full batch.
                    </DialogDescription>
                </DialogHeader>

                {loading ? (
                    <div className="flex min-h-48 flex-col items-center justify-center gap-2 text-muted-foreground">
                        <Loader2 className="size-5 animate-spin" />
                        Loading batch detail
                    </div>
                ) : detail ? (
                    <div className="flex flex-col gap-4">
                        <div className="grid gap-3 rounded-md border bg-muted/30 p-3 text-sm sm:grid-cols-4">
                            <div>
                                <div className="text-xs font-medium uppercase text-muted-foreground">Supplier</div>
                                <div className="mt-1 font-medium">{detail.supplier_name || "-"}</div>
                            </div>
                            <div>
                                <div className="text-xs font-medium uppercase text-muted-foreground">Status</div>
                                <div className="mt-1">
                                    <Badge variant="outline" className={pcrStatusBadgeClass(detail.status)}>
                                        {detail.status}
                                    </Badge>
                                </div>
                            </div>
                            <div>
                                <div className="text-xs font-medium uppercase text-muted-foreground">Requested At</div>
                                <div className="mt-1 font-medium">{safeDate(detail.requested_at)}</div>
                            </div>
                            <div>
                                <div className="text-xs font-medium uppercase text-muted-foreground">Lines</div>
                                <div className="mt-1 font-medium">{lines.length.toLocaleString()}</div>
                            </div>
                            <div className="sm:col-span-2">
                                <div className="text-xs font-medium uppercase text-muted-foreground">Reference No.</div>
                                <div className="mt-1 font-medium">{detail.reference_no || "-"}</div>
                            </div>
                            <div className="sm:col-span-2">
                                <div className="text-xs font-medium uppercase text-muted-foreground">Remarks</div>
                                <div className="mt-1 font-medium">{detail.remarks || "-"}</div>
                            </div>
                        </div>

                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Product</TableHead>
                                        <TableHead className="w-[110px]">Price Type</TableHead>
                                        <TableHead className="w-[140px] text-right">Current</TableHead>
                                        <TableHead className="w-[140px] text-right">Proposed</TableHead>
                                        <TableHead className="w-[130px] text-right">Change</TableHead>
                                        <TableHead className="w-[120px] text-right">% Change</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {lines.map((line) => (
                                        <TableRow key={`${line.request_id ?? line.product_id}-${line.price_type_id}`}>
                                            <TableCell className="max-w-[360px]">
                                                <div className="truncate font-medium">{line.product_name || `Product #${line.product_id}`}</div>
                                                {line.product_code ? (
                                                    <div className="text-xs text-muted-foreground">{line.product_code}</div>
                                                ) : null}
                                            </TableCell>
                                            <TableCell>{line.price_type_name || `#${line.price_type_id}`}</TableCell>
                                            <TableCell className="text-right">{money(line.current_price)}</TableCell>
                                            <TableCell className="text-right font-medium">{money(line.proposed_price)}</TableCell>
                                            <TableCell className={cn("text-right font-medium", diffClass(line))}>
                                                {money(line.delta)}
                                            </TableCell>
                                            <TableCell className={cn("text-right", diffClass(line))}>
                                                {percent(line.percent_change)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {lines.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                                                No detail lines found.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={2} className="font-medium">
                                                Total
                                            </TableCell>
                                            <TableCell className="text-right font-medium">{money(currentTotal)}</TableCell>
                                            <TableCell className="text-right font-medium">{money(proposedTotal)}</TableCell>
                                            <TableCell className="text-right font-medium">{money(proposedTotal - currentTotal)}</TableCell>
                                            <TableCell />
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                ) : (
                    <div className="py-10 text-center text-muted-foreground">No batch selected.</div>
                )}

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Close
                    </Button>
                    {isPending && headerId ? (
                        <>
                            <Button
                                variant="destructive"
                                onClick={() => onReject(headerId)}
                                disabled={acting}
                            >
                                Reject Batch
                            </Button>
                            <Button
                                onClick={() => onApprove(headerId)}
                                disabled={acting}
                            >
                                {acting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                                Approve Batch
                            </Button>
                        </>
                    ) : null}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
