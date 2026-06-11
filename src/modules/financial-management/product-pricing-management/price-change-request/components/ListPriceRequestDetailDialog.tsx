"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";

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
import { cn } from "@/lib/utils";

import type { UnifiedApprovalRow } from "../types";
import { pcrApproveButtonClass, pcrRejectButtonClass, pcrStatusBadgeClass } from "../utils/pcrStatusStyles";

type Props = {
    row: UnifiedApprovalRow | null;
    open: boolean;
    acting: boolean;
    onOpenChange: (open: boolean) => void;
    onApprove: (requestId: number) => void;
    onReject: (requestId: number) => void;
};

function money(value: number | null | undefined) {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) return "—";
    return Number(value).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
    const requestId = row?.request_id ? Number(row.request_id) : null;
    const isPending = row?.status === "PENDING";
    const currentCost = row?.current_cost ?? null;
    const proposedCost = row?.proposed_cost ?? null;
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

    return (
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
                                <div className="text-xs font-medium uppercase text-muted-foreground">Requested At</div>
                                <div className="mt-1 font-medium">{safeDate(row.requested_at)}</div>
                            </div>
                        </div>

                        <div className="rounded-md border">
                            <div className="grid grid-cols-3 gap-2 border-b bg-muted/30 px-3 py-2 text-xs font-medium uppercase text-muted-foreground">
                                <div>Current</div>
                                <div>Proposed</div>
                                <div className="text-right">Change</div>
                            </div>
                            <div className="grid grid-cols-3 gap-2 px-3 py-3 text-sm">
                                <div className="font-medium">₱{money(currentCost)}</div>
                                <div className="font-medium">₱{money(proposedCost)}</div>
                                <div className={cn("text-right font-medium", deltaClass(currentCost, proposedCost))}>
                                    {delta === null ? "—" : `₱${money(delta)}`}
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
                    </div>
                )}

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Close
                    </Button>
                    {isPending && requestId ? (
                        <>
                            <Button
                                variant="outline"
                                className={pcrRejectButtonClass}
                                onClick={() => onReject(requestId)}
                                disabled={acting}
                            >
                                Reject
                            </Button>
                            <Button className={pcrApproveButtonClass} onClick={() => onApprove(requestId)} disabled={acting}>
                                {acting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                                Approve
                            </Button>
                        </>
                    ) : null}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
