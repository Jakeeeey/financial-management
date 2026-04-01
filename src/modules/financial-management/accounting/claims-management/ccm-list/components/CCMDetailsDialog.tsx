"use client";

import * as React from "react";
import type { CCMRow } from "../utils/types";
import { toBoolLike, toNumberSafe } from "../utils/parse";
import { formatPHP, formatDateTime } from "../utils/format";

import { getBalanceType, getChartOfAccount } from "../providers/lookupsService";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";

import { CCMStatusBadge } from "./CCMStatusBadge";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between gap-4 text-sm">
            <div className="text-muted-foreground">{label}</div>
            <div className="max-w-[70%] break-words text-right font-mono">{value}</div>
        </div>
    );
}

type CcmRowLike = CCMRow & {
    chart_of_account?: unknown;
    type?: unknown;
    isPending?: unknown;
    isClaimed?: unknown;
};

function toInt(value: unknown): number | null {
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

export function CCMDetailsDialog({
                                     open,
                                     onOpenChange,
                                     row,
                                 }: {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    row: CCMRow | null;
}) {
    const [coaTitle, setCoaTitle] = React.useState<string | null>(null);
    const [coaGl, setCoaGl] = React.useState<string | null>(null);
    const [balanceName, setBalanceName] = React.useState<string | null>(null);

    const typedRow = row as CcmRowLike | null;

    React.useEffect(() => {
        if (!open || !typedRow) return;

        const coaId = toInt(typedRow.chart_of_account);
        const typeId = toInt(typedRow.type);

        const ac = new AbortController();

        setCoaTitle(null);
        setCoaGl(null);
        setBalanceName(null);

        void (async () => {
            try {
                if (coaId != null) {
                    const coa = await getChartOfAccount(coaId, ac.signal);
                    setCoaTitle(coa?.account_title ?? null);
                    setCoaGl(coa?.gl_code ?? null);
                }

                if (typeId != null) {
                    const bt = await getBalanceType(typeId, ac.signal);
                    setBalanceName(bt?.balance_name ?? null);
                }
            } catch {
                // silent: keep fallback display as IDs
            }
        })();

        return () => ac.abort();
    }, [open, typedRow]);

    if (!typedRow) return null;

    const amount = toNumberSafe(typedRow.amount) ?? 0;
    const applied = toNumberSafe(typedRow.applied_amount) ?? 0;
    const pending = toBoolLike(typedRow.isPending);
    const claimed = toBoolLike(typedRow.isClaimed);

    const coaDisplay = coaTitle
        ? `${coaTitle}${coaGl ? ` (${coaGl})` : ""}`
        : typedRow.chart_of_account ?? "—";

    const typeDisplay = balanceName ?? typedRow.type ?? "—";

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[95vw] max-w-4xl md:max-w-5xl lg:max-w-6xl">
                <DialogHeader>
                    <DialogTitle className="flex flex-wrap items-center gap-2">
                        CCM Details
                        <Badge variant="outline" className="font-mono">
                            {typedRow.memo_number || `#${typedRow.id}`}
                        </Badge>
                        <CCMStatusBadge status={typedRow.status} />
                    </DialogTitle>
                    <DialogDescription>
                        Read-only view of the Customer Credit Memo source record.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-5">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="rounded-lg border p-3">
                            <div className="text-xs text-muted-foreground">Supplier</div>
                            <div className="mt-1 break-words text-sm font-medium">
                                {typedRow.supplier_name ?? (typedRow.supplier_id ?? "—")}
                            </div>
                        </div>

                        <div className="rounded-lg border p-3">
                            <div className="text-xs text-muted-foreground">Customer</div>
                            <div className="mt-1 break-words text-sm font-medium">
                                {typedRow.customer_name ?? (typedRow.customer_id ?? "—")}
                            </div>
                        </div>

                        <div className="rounded-lg border p-3">
                            <div className="text-xs text-muted-foreground">Amount</div>
                            <div className="mt-1 font-mono text-sm">{formatPHP(amount)}</div>
                        </div>

                        <div className="rounded-lg border p-3">
                            <div className="text-xs text-muted-foreground">Applied Amount</div>
                            <div className="mt-1 font-mono text-sm">{formatPHP(applied)}</div>
                        </div>
                    </div>

                    <Separator />

                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        <div className="space-y-2">
                            <div className="text-sm font-semibold">Memo Info</div>
                            <div className="space-y-3 rounded-lg border p-4">
                                <Row label="Memo #" value={typedRow.memo_number || "—"} />
                                <Row label="Reason" value={typedRow.reason ?? "—"} />
                                <Row label="Type" value={typeDisplay} />
                                <Row label="Chart of Account" value={coaDisplay} />
                                <Row
                                    label="Created At"
                                    value={formatDateTime(typedRow.created_at)}
                                />
                                <Row
                                    label="Updated At"
                                    value={formatDateTime(typedRow.updated_at)}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="text-sm font-semibold">References</div>
                            <div className="space-y-3 rounded-lg border p-4">
                                <Row label="Pending" value={pending ? "Yes" : "No"} />
                                <Row label="Claimed" value={claimed ? "Yes" : "No"} />
                                <Row
                                    label="Customer Ref"
                                    value={typedRow.customer_reference ?? "—"}
                                />
                                <Row
                                    label="Supplier Ref"
                                    value={typedRow.supplier_reference ?? "—"}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}