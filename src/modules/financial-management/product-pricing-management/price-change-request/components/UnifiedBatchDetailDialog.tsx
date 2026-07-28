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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import type { UnifiedBatchDetail, UnifiedBatchLine } from "../types";
import { getUnifiedBatch } from "../providers/pcrApi";
import { BatchDecisionSummaryFields } from "./BatchDecisionSummaryFields";
import { DecisionConfirmationDialog } from "./DecisionConfirmationDialog";
import { RejectDialog } from "./RejectDialog";
import { displayPcrStatus, pcrApproveButtonClass, pcrStatusBadgeClass } from "../utils/pcrStatusStyles";

type Props = {
    batchId: number | null;
    open: boolean;
    acting: boolean;
    readOnly?: boolean;
    onOpenChange: (open: boolean) => void;
    onApprove?: (headerId: number, effectiveAt?: string | null) => Promise<void> | void;
    onReject?: (headerId: number, reason: string) => Promise<void> | void;
    onApplyScheduledNow?: (headerId: number) => Promise<void> | void;
    onRetryApplication?: (headerId: number) => Promise<void> | void;
};

function money(value: number | null | undefined) {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) return "-";
    return new Intl.NumberFormat("en-PH", {
        style: "currency",
        currency: "PHP",
        minimumFractionDigits: 2,
        maximumFractionDigits: 4,
    }).format(Number(value));
}

function safeDate(value: string | null | undefined) {
    if (!value) return "-";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function lineProposed(line: UnifiedBatchLine) {
    return line.kind === "price_type" ? line.proposed_price : line.proposed_cost;
}

function lineCurrent(line: UnifiedBatchLine) {
    return line.kind === "price_type" ? line.current_price : line.current_cost;
}

function LineTable({ lines }: { lines: UnifiedBatchLine[] }) {
    return (
        <div className="overflow-hidden rounded-lg border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>UOM</TableHead>
                        <TableHead className="text-right">Current</TableHead>
                        <TableHead className="text-right">Proposed</TableHead>
                        <TableHead>Status</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {lines.map((line) => (
                        <TableRow key={`${line.kind}-${line.request_id}`}>
                            <TableCell>
                                <div className="font-medium">{line.product_name || `Product #${line.product_id}`}</div>
                                {line.product_code ? <div className="text-xs text-muted-foreground">{line.product_code}</div> : null}
                            </TableCell>
                            <TableCell>
                                <Badge variant="outline">{line.kind === "price_type" ? line.price_type_name || "Price Type" : "List Cost"}</Badge>
                            </TableCell>
                            <TableCell>{line.unit_name || "-"}</TableCell>
                            <TableCell className="text-right">{money(lineCurrent(line))}</TableCell>
                            <TableCell className="text-right font-medium">{money(lineProposed(line))}</TableCell>
                            <TableCell>
                                <Badge variant="outline" className={pcrStatusBadgeClass(displayPcrStatus(line.status, line.application_status, line.effective_at))}>
                                    {displayPcrStatus(line.status, line.application_status, line.effective_at)}
                                </Badge>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}

export function UnifiedBatchDetailDialog({
    batchId,
    open,
    acting,
    readOnly = false,
    onOpenChange,
    onApprove,
    onReject,
    onApplyScheduledNow,
    onRetryApplication,
}: Props) {
    const [detail, setDetail] = React.useState<UnifiedBatchDetail | null>(null);
    const [loading, setLoading] = React.useState(false);
    const [confirmingApprove, setConfirmingApprove] = React.useState(false);
    const [rejecting, setRejecting] = React.useState(false);

    React.useEffect(() => {
        let cancelled = false;
        if (!open || !batchId) {
            setDetail(null);
            return;
        }

        setLoading(true);
        void getUnifiedBatch(batchId)
            .then((result) => {
                if (!cancelled) setDetail(result.data);
            })
            .catch((error: unknown) => {
                if (!cancelled) toast.error(error instanceof Error ? error.message : "Failed to load mixed batch detail");
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [batchId, open]);

    const isPending = detail?.status === "PENDING";
    const canAct = !readOnly && isPending && Boolean(onApprove && onReject) && !loading;
    const isScheduled = detail?.status === "APPROVED" && detail.application_status === "SCHEDULED";
    const canApplyScheduledNow = !readOnly && isScheduled && Boolean(onApplyScheduledNow) && !loading && !acting;
    const canRetry = !readOnly && detail?.application_status === "FAILED" && Boolean(detail.retryable) && Boolean(onRetryApplication) && !loading && !acting;
    const displayStatus = detail ? displayPcrStatus(detail.status, detail.application_status, detail.effective_at) : "";

    const handleRetryApplication = async () => {
        if (!batchId || !onRetryApplication) return;
        await onRetryApplication(batchId);
        const result = await getUnifiedBatch(batchId);
        setDetail(result.data);
    };

    const handleApplyScheduledNow = async () => {
        if (!batchId || !onApplyScheduledNow) return;
        await onApplyScheduledNow(batchId);
        const result = await getUnifiedBatch(batchId);
        setDetail(result.data);
    };

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Unified Price Change Batch {batchId ? `PCB-${batchId}` : ""}</DialogTitle>
                        <DialogDescription>
                            Price Type and List Cost changes are reviewed and decided together under one batch lifecycle.
                        </DialogDescription>
                    </DialogHeader>

                    {loading ? (
                        <div className="flex min-h-32 items-center justify-center text-sm text-muted-foreground">
                            <Loader2 className="mr-2 size-5 animate-spin" /> Loading batch details
                        </div>
                    ) : detail ? (
                        <div className="space-y-5">
                            <div className="grid gap-3 rounded-lg border bg-muted/20 p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
                                <div><div className="text-xs uppercase text-muted-foreground">Supplier</div><div className="mt-1 font-medium">{detail.supplier_name || "-"}</div></div>
                                <div><div className="text-xs uppercase text-muted-foreground">Reference</div><div className="mt-1 font-medium">{detail.reference_no || "-"}</div></div>
                                <div><div className="text-xs uppercase text-muted-foreground">Requested</div><div className="mt-1 font-medium">{safeDate(detail.requested_at)}</div></div>
                                <div><div className="text-xs uppercase text-muted-foreground">Status</div><Badge variant="outline" className={`mt-1 ${pcrStatusBadgeClass(displayStatus)}`}>{displayStatus}</Badge></div>
                                <BatchDecisionSummaryFields detail={detail} />
                            </div>

                            {detail.application_error ? (
                                <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
                                    <div className="font-medium">Application issue</div>
                                    <div className="mt-1">{detail.application_error}</div>
                                    {detail.application_attempts != null ? (
                                        <div className="mt-1 text-xs">Attempts: {detail.application_attempts}</div>
                                    ) : null}
                                </div>
                            ) : null}

                            {detail.remarks ? <div className="rounded-lg border p-3 text-sm"><span className="font-medium">Remarks:</span> {detail.remarks}</div> : null}

                            <section className="space-y-2">
                                <div className="flex items-center justify-between"><h3 className="font-semibold">Price Type Lines ({detail.price_details.length})</h3><Badge variant="outline">PRICE TYPE</Badge></div>
                                <LineTable lines={detail.price_details} />
                            </section>

                            <section className="space-y-2">
                                <div className="flex items-center justify-between"><h3 className="font-semibold">List Cost Lines ({detail.cost_details.length})</h3><Badge variant="outline">LIST COST</Badge></div>
                                <LineTable lines={detail.cost_details} />
                            </section>
                        </div>
                    ) : (
                        <div className="py-10 text-center text-sm text-muted-foreground">No batch details found.</div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={acting}>Close</Button>
                        {canAct ? (
                            <>
                                <Button variant="outline" className="border-red-600 text-red-600" onClick={() => setRejecting(true)} disabled={acting}>Reject Batch</Button>
                                <Button className={pcrApproveButtonClass} onClick={() => setConfirmingApprove(true)} disabled={acting}>Approve Batch</Button>
                            </>
                        ) : null}
                        {canApplyScheduledNow ? (
                            <Button className={pcrApproveButtonClass} onClick={() => void handleApplyScheduledNow()} disabled={acting}>
                                {acting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                                Apply Now
                            </Button>
                        ) : null}
                        {canRetry ? (
                            <Button className={pcrApproveButtonClass} onClick={() => void handleRetryApplication()} disabled={acting}>
                                {acting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                                Retry Application
                            </Button>
                        ) : null}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <DecisionConfirmationDialog
                open={confirmingApprove}
                action="approve"
                recordLabel={`PCB-${batchId ?? ""}`}
                loading={acting}
                description="Approve the complete batch, including all Price Type and List Cost lines?"
                onOpenChange={setConfirmingApprove}
                onConfirm={async (effectiveAt) => {
                    if (!batchId || !onApprove) return;
                    await onApprove(batchId, effectiveAt);
                    setConfirmingApprove(false);
                    onOpenChange(false);
                }}
            />

            <RejectDialog
                open={rejecting}
                loading={acting}
                title="Reject Unified Price Change Batch"
                onOpenChange={setRejecting}
                onConfirm={async (reason) => {
                    if (!batchId || !onReject || !reason) return;
                    await onReject(batchId, reason);
                    setRejecting(false);
                    onOpenChange(false);
                }}
            />
        </>
    );
}
