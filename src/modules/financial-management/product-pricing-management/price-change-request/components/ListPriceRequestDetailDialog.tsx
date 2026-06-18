"use client";

import * as React from "react";

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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import type { UnifiedApprovalRow } from "../types";
import { DecisionConfirmationDialog } from "./DecisionConfirmationDialog";
import { decisionUserLabel } from "../utils/labels";
import { pcrApproveButtonClass, pcrRejectButtonClass, pcrStatusBadgeClass } from "../utils/pcrStatusStyles";

type Props = {
    row: UnifiedApprovalRow | null;
    open: boolean;
    acting: boolean;
    onOpenChange: (open: boolean) => void;
    onApprove: (requestId: number) => Promise<void>;
    onReject: (requestId: number, reason: string) => Promise<void>;
};

function money(value: number | null | undefined) {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) return "—";
    return new Intl.NumberFormat("en-PH", {
        style: "currency",
        currency: "PHP",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(Number(value));
}

function safeDate(value: string | null | undefined) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
}

function deltaClass(current: number | null | undefined, proposed: number | null | undefined) {
    const currentValue = Number(current);
    const proposedValue = Number(proposed);
    if (!Number.isFinite(currentValue) || !Number.isFinite(proposedValue)) return "text-muted-foreground";
    const delta = proposedValue - currentValue;
    if (delta > 0) return "text-destructive";
    if (delta < 0) return "text-emerald-600";
    return "text-muted-foreground";
}

export function ListPriceRequestDetailDialog({
    row,
    open,
    acting,
    onOpenChange,
    onApprove,
    onReject,
}: Props) {
    const [rejecting, setRejecting] = React.useState(false);
    const [rejectReason, setRejectReason] = React.useState("");
    const [confirmingAction, setConfirmingAction] = React.useState<"approve" | "reject" | null>(null);
    const [submitting, setSubmitting] = React.useState(false);

    React.useEffect(() => {
        if (!open) {
            setRejecting(false);
            setRejectReason("");
            setConfirmingAction(null);
            setSubmitting(false);
        }
    }, [open]);

    const requestId = row?.kind === "list_price" && row.request_id ? Number(row.request_id) : null;
    const isPending = row?.status === "PENDING";
    const currentCost = row?.kind === "list_price" ? row.current_cost : null;
    const proposedCost = row?.kind === "list_price" ? row.proposed_cost : null;
    const rejectReasonValue = row?.kind === "list_price" ? row.reject_reason : null;
    const approvedBy = row?.kind === "list_price" ? row.approved_by : null;
    const approvedByName = row?.kind === "list_price" ? row.approved_by_name : null;
    const rejectedBy = row?.kind === "list_price" ? row.rejected_by : null;
    const rejectedByName = row?.kind === "list_price" ? row.rejected_by_name : null;
    const currentNumeric = Number(currentCost);
    const proposedNumeric = Number(proposedCost);
    const delta =
        Number.isFinite(currentNumeric) && Number.isFinite(proposedNumeric)
            ? proposedNumeric - currentNumeric
            : null;
    const percentChange =
        delta !== null && Number.isFinite(currentNumeric) && currentNumeric !== 0
            ? (delta / currentNumeric) * 100
            : null;
    const status = String(row?.status ?? "").toUpperCase();
    const busy = acting || submitting;

    const handleApprove = async () => {
        if (!requestId) return;
        setSubmitting(true);
        try {
            await onApprove(requestId);
            setConfirmingAction(null);
            onOpenChange(false);
        } finally {
            setSubmitting(false);
        }
    };

    const handleReject = async () => {
        if (!requestId || !rejectReason.trim()) return;
        setSubmitting(true);
        try {
            await onReject(requestId, rejectReason.trim());
            setConfirmingAction(null);
            onOpenChange(false);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>{row?.record_label ?? "List Cost Request"}</DialogTitle>
                    <DialogDescription>Review the current and proposed list cost before approving.</DialogDescription>
                </DialogHeader>

                {!row ? (
                    <div className="py-8 text-center text-sm text-muted-foreground">No request selected.</div>
                ) : (
                    <div className="flex flex-col gap-4">
                        <div className="grid gap-3 rounded-md border bg-muted/30 p-3 text-sm sm:grid-cols-2">
                            <div className="sm:col-span-2">
                                <div className="text-xs font-medium uppercase text-muted-foreground">Product</div>
                                <div className="mt-1 font-medium">{row.title}</div>
                                {row.subtitle ? (
                                    <div className="text-xs text-muted-foreground">{row.subtitle}</div>
                                ) : null}
                            </div>
                            <div>
                                <div className="text-xs font-medium uppercase text-muted-foreground">Status</div>
                                <div className="mt-1">
                                    <Badge variant="outline" className={pcrStatusBadgeClass(row.status)}>
                                        {row.status}
                                    </Badge>
                                </div>
                            </div>
                            <div>
                                <div className="text-xs font-medium uppercase text-muted-foreground">Requested By</div>
                                <div className="mt-1 font-medium">
                                    {decisionUserLabel(row.requested_by, row.requested_by_name)}
                                </div>
                            </div>
                            <div>
                                <div className="text-xs font-medium uppercase text-muted-foreground">Requested At</div>
                                <div className="mt-1 font-medium">{safeDate(row.requested_at)}</div>
                            </div>
                            {status === "APPROVED" ? (
                                <div>
                                    <div className="text-xs font-medium uppercase text-muted-foreground">Approved By</div>
                                    <div className="mt-1 font-medium">
                                        {decisionUserLabel(approvedBy, approvedByName)}
                                    </div>
                                </div>
                            ) : null}
                            {status === "REJECTED" ? (
                                <div>
                                    <div className="text-xs font-medium uppercase text-muted-foreground">Rejected By</div>
                                    <div className="mt-1 font-medium">
                                        {decisionUserLabel(rejectedBy, rejectedByName)}
                                    </div>
                                </div>
                            ) : null}
                            {rejectReasonValue ? (
                                <div className="sm:col-span-2">
                                    <div className="text-xs font-medium uppercase text-muted-foreground">Reject Reason</div>
                                    <div className="mt-1 whitespace-pre-wrap text-sm">{rejectReasonValue}</div>
                                </div>
                            ) : null}
                        </div>

                        <div className="rounded-md border">
                            <div className="grid grid-cols-3 gap-2 border-b bg-muted/30 px-3 py-2 text-xs font-medium uppercase text-muted-foreground">
                                <div>Current</div>
                                <div>Proposed</div>
                                <div className="text-right">Change</div>
                            </div>
                            <div className="grid grid-cols-3 gap-2 px-3 py-3 text-sm">
                                <div className="font-medium">{money(currentCost)}</div>
                                <div className="font-medium">{money(proposedCost)}</div>
                                <div className={cn("text-right font-medium", deltaClass(currentCost, proposedCost))}>
                                    {delta === null ? "—" : money(delta)}
                                    {percentChange !== null ? (
                                        <div className="text-xs font-normal">
                                            {percentChange.toLocaleString("en-PH", {
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2,
                                            })}
                                            %
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        </div>

                        {rejecting ? (
                            <div className="space-y-2">
                                <Label>Reject Reason</Label>
                                <Textarea
                                    value={rejectReason}
                                    onChange={(event) => setRejectReason(event.target.value)}
                                    placeholder="Enter reason..."
                                    rows={4}
                                />
                            </div>
                        ) : null}
                    </div>
                )}

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
                        Close
                    </Button>
                    {isPending && requestId ? (
                        rejecting ? (
                            <>
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setRejecting(false);
                                        setRejectReason("");
                                    }}
                                    disabled={busy}
                                >
                                    Cancel Reject
                                </Button>
                                <Button
                                    variant="destructive"
                                    onClick={() => setConfirmingAction("reject")}
                                    disabled={busy || !rejectReason.trim()}
                                >
                                    Confirm Reject
                                </Button>
                            </>
                        ) : (
                            <>
                                <Button
                                    variant="outline"
                                    className={pcrRejectButtonClass}
                                    onClick={() => setRejecting(true)}
                                    disabled={busy}
                                >
                                    Reject
                                </Button>
                                <Button
                                    className={pcrApproveButtonClass}
                                    onClick={() => setConfirmingAction("approve")}
                                    disabled={busy}
                                >
                                    Approve
                                </Button>
                            </>
                        )
                    ) : null}
                </DialogFooter>
            </DialogContent>
        </Dialog>

            <DecisionConfirmationDialog
                open={confirmingAction != null}
                action={confirmingAction ?? "approve"}
                recordLabel={row?.record_label ?? "List Cost Request"}
                loading={busy}
                rejectReason={confirmingAction === "reject" ? rejectReason.trim() : undefined}
                onOpenChange={(nextOpen) => {
                    if (!nextOpen) setConfirmingAction(null);
                }}
                onConfirm={confirmingAction === "reject" ? handleReject : handleApprove}
            />
        </>
    );
}
