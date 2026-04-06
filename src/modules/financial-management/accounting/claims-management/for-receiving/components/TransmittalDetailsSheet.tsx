// src/modules/financial-management/claims-management/for-receiving/components/TransmittalDetailsSheet.tsx
"use client";

import * as React from "react";
import { toast } from "sonner";
import { Loader2, Plus, X, Send, Printer } from "lucide-react";

import type { TransmittalRow } from "../utils/types";
import { formatDateTime, formatPHP, toNumberSafe } from "../utils/format";

import * as api from "../providers/receivingApi";
import { useTransmittalDetails } from "../hooks/useTransmittalDetails";

import AddCCMDialog from "./AddCCMDialog";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

/* =========================
   Helpers (no any)
========================= */

function isRecord(v: unknown): v is Record<string, unknown> {
    return typeof v === "object" && v !== null;
}

function errorMessage(e: unknown): string {
    if (e instanceof Error) return e.message;
    if (typeof e === "string") return e;
    if (e == null) return "Unknown error";
    return String(e);
}

function safeMemoNo(memo_number: unknown, customer_memo_id: unknown): string {
    const raw = typeof memo_number === "string" ? memo_number.trim() : memo_number;
    if (!raw || raw === "null" || raw === "undefined") return `CCM #${String(customer_memo_id ?? "")}`;
    return String(raw);
}

function safeText(v: unknown): string {
    return typeof v === "string" ? v : v == null ? "" : String(v);
}

function coaLabel(r: unknown): string {
    const rec = isRecord(r) ? r : {};
    const gl = safeText(rec["gl_code"]).trim();
    const title = safeText(rec["account_title"]).trim();
    if (gl && title) return `${gl} — ${title}`;
    return title || gl || "—";
}

type DetailLike = {
    id?: unknown;
    customer_memo_id?: unknown;
    memo_number?: unknown;
    supplier_name?: unknown;
    customer_name?: unknown;
    remarks?: unknown;
    reason?: unknown;
    total?: unknown;
    amount?: unknown;
    grand_total?: unknown;
    credit_date?: unknown;
    created_at?: unknown;
    gl_code?: unknown;
    account_title?: unknown;
};

function asDetailLike(v: unknown): DetailLike {
    return isRecord(v) ? (v as DetailLike) : {};
}

function pickCreatedByName(transmittal: TransmittalRow | null): string {
    if (!transmittal) return "—";
    const rec: Record<string, unknown> = isRecord(transmittal) ? transmittal : {};
    const v = rec["created_by_name"];
    const s = safeText(v).trim();
    return s.length ? s : "—";
}

export function TransmittalDetailsSheet({
                                            open,
                                            onOpenChange,
                                            transmittal,
                                            onAfterUpdate,
                                        }: {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    transmittal: TransmittalRow | null;
    onAfterUpdate: () => void;
}) {
    const id = transmittal?.id ?? null;

    const { rows, loading, error, reload } = useTransmittalDetails(id ?? 0, open && !!id);

    const [busyRemove, setBusyRemove] = React.useState<number | null>(null);
    const [addOpen, setAddOpen] = React.useState(false);
    const [sending, setSending] = React.useState(false);

    React.useEffect(() => {
        if (!open) {
            setBusyRemove(null);
            setAddOpen(false);
            setSending(false);
            return;
        }
        setBusyRemove(null);
        setAddOpen(false);
        setSending(false);
    }, [open, id]);

    async function onRemove(detailId: number) {
        if (!id) return;
        if (sending) return;

        try {
            setBusyRemove(detailId);
            await api.removeDetailLine(detailId);
            toast.success("CCM removed.");
            reload();
            onAfterUpdate();
        } catch (e: unknown) {
            toast.error(errorMessage(e));
        } finally {
            setBusyRemove(null);
        }
    }

    async function onSendToPayment() {
        if (!id) return;
        if (sending) return;

        try {
            setSending(true);
            await api.sendTransmittalToPayment(id);
            toast.success("Sent to Payment.");

            setAddOpen(false);
            onOpenChange(false);
            onAfterUpdate();
        } catch (e: unknown) {
            toast.error(errorMessage(e));
        } finally {
            setSending(false);
        }
    }

    function onPrint() {
        // simple + stable: prints whatever is currently shown
        window.print();
    }

    const ccmCount = Array.isArray(rows) ? rows.length : 0;

    const createdByName = pickCreatedByName(transmittal);

    const existingMemoIds = React.useMemo(() => {
        return rows
            .map((d) => {
                const rec = asDetailLike(d);
                const n = Number(rec.customer_memo_id);
                return Number.isFinite(n) ? n : 0;
            })
            .filter((n) => n > 0);
    }, [rows]);

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="right"
                className={[
                    "w-full",
                    "sm:max-w-2xl",
                    "lg:max-w-4xl",
                    "xl:max-w-5xl",
                    "min-w-0 overflow-hidden",
                ].join(" ")}
            >
                <SheetHeader className="mb-4 no-print">
                    <SheetTitle className="text-base">Transmittal Details</SheetTitle>
                </SheetHeader>

                {!transmittal ? (
                    <div className="text-sm text-muted-foreground">No transmittal selected.</div>
                ) : (
                    <div className="min-h-0 space-y-4">
                        {/* Summary */}
                        <Card>
                            <CardContent className="p-5">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="text-sm font-semibold">
                                            {transmittal.transmittal_no ?? `TRN-${transmittal.id}`}
                                        </div>

                                        <div className="mt-1 text-sm text-muted-foreground">
                                            {transmittal.supplier_name ??
                                                (transmittal.supplier_id
                                                    ? `Supplier #${transmittal.supplier_id}`
                                                    : "—")}
                                            {transmittal.representative_name ? (
                                                <span className="text-muted-foreground">
                                                    {" "}
                                                    • {transmittal.representative_name}
                                                </span>
                                            ) : null}
                                        </div>

                                        {/* ✅ Created by */}
                                        <div className="mt-1 text-xs text-muted-foreground">
                                            Created by:{" "}
                                            <span className="text-foreground font-medium">{createdByName}</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 no-print">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="cursor-pointer"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                onPrint();
                                            }}
                                        >
                                            <Printer className="mr-2 h-4 w-4" />
                                            Print
                                        </Button>

                                        <Badge className="rounded-full px-3 py-1" variant="secondary">
                                            {String(transmittal.status ?? "FOR RECEIVING")}
                                        </Badge>
                                    </div>
                                </div>

                                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                                    <div>
                                        <div className="text-xs text-muted-foreground">Created</div>
                                        <div className="mt-1 text-sm">
                                            {transmittal.created_at ? formatDateTime(transmittal.created_at) : "—"}
                                        </div>
                                    </div>

                                    <div className="text-right">
                                        <div className="text-xs text-muted-foreground">Grand Total</div>
                                        <div className="mt-1 text-xl font-semibold">
                                            {formatPHP(toNumberSafe(transmittal.total_amount))}
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Lines */}
                        <Card className="min-h-0">
                            <CardContent className="p-5">
                                <div className="flex items-start justify-between gap-3 no-print">
                                    <div>
                                        <div className="text-sm font-semibold">Customer Credit Memos</div>
                                        <div className="mt-1 text-sm text-muted-foreground">{ccmCount} CCM(s)</div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="cursor-pointer"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setAddOpen(true);
                                            }}
                                            disabled={!id || sending}
                                        >
                                            <Plus className="mr-2 h-4 w-4" />
                                            Add CCM
                                        </Button>

                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="cursor-pointer"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                reload();
                                            }}
                                            disabled={loading || sending}
                                        >
                                            Refresh
                                        </Button>
                                    </div>
                                </div>

                                <Separator className="my-4 no-print" />

                                {error ? (
                                    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 no-print">
                                        <div className="text-sm font-medium text-destructive">Failed to load</div>
                                        <div className="mt-1 text-sm text-muted-foreground">{String(error)}</div>
                                    </div>
                                ) : null}

                                <div className="rounded-lg border">
                                    <ScrollArea className="h-[420px] pr-2">
                                        <Table>
                                            <TableHeader className="sticky top-0 z-10 bg-background">
                                                <TableRow>
                                                    <TableHead>Chart of Accounts</TableHead>
                                                    <TableHead className="w-[160px]">Credit Date</TableHead>

                                                    <TableHead className="w-[220px]">Supplier</TableHead>
                                                    <TableHead className="w-[280px]">Customer Name</TableHead>

                                                    <TableHead className="w-[240px]">Remarks</TableHead>
                                                    <TableHead className="w-[140px] text-right">Total</TableHead>
                                                    <TableHead className="w-[140px] text-right">Grand Total</TableHead>
                                                    <TableHead className="w-[56px] no-print" />
                                                </TableRow>
                                            </TableHeader>

                                            <TableBody>
                                                {loading ? (
                                                    <TableRow>
                                                        <TableCell
                                                            colSpan={9}
                                                            className="py-10 text-center text-sm text-muted-foreground"
                                                        >
                                                            <span className="inline-flex items-center gap-2">
                                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                                Loading CCMs…
                                                            </span>
                                                        </TableCell>
                                                    </TableRow>
                                                ) : rows.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell
                                                            colSpan={9}
                                                            className="py-10 text-center text-sm text-muted-foreground"
                                                        >
                                                            No CCM lines found.
                                                        </TableCell>
                                                    </TableRow>
                                                ) : (
                                                    rows.map((raw) => {
                                                        const r = asDetailLike(raw);

                                                        const rowId = Number(r.id);
                                                        const rowIdSafe = Number.isFinite(rowId) ? rowId : 0;

                                                        const memoNo = safeMemoNo(r.memo_number, r.customer_memo_id);
                                                        const isRemoving = busyRemove === rowIdSafe;

                                                        const creditDate = (r.credit_date ?? r.created_at ?? null) as
                                                            | string
                                                            | null;

                                                        const supplier = safeText(r.supplier_name).trim() || "—";
                                                        const customer = safeText(r.customer_name).trim() || "—";
                                                        const remarks =
                                                            safeText(r.remarks).trim() ||
                                                            safeText(r.reason).trim() ||
                                                            "—";

                                                        const total = toNumberSafe(r.total ?? r.amount);
                                                        const grand = toNumberSafe(r.grand_total ?? r.amount);

                                                        return (
                                                            <TableRow key={rowIdSafe || memoNo}>
                                                                <TableCell className="text-sm">{coaLabel(r)}</TableCell>

                                                                <TableCell>{formatDateTime(creditDate)}</TableCell>
                                                                <TableCell className="font-medium">{memoNo}</TableCell>
                                                                <TableCell className="text-sm text-muted-foreground">
                                                                    {supplier}
                                                                </TableCell>
                                                                <TableCell className="text-sm text-muted-foreground">
                                                                    {customer}
                                                                </TableCell>
                                                                <TableCell className="text-sm text-muted-foreground">
                                                                    <div className="line-clamp-2">{remarks}</div>
                                                                </TableCell>
                                                                <TableCell className="text-right font-medium">
                                                                    {formatPHP(total)}
                                                                </TableCell>
                                                                <TableCell className="text-right font-medium">
                                                                    {formatPHP(grand)}
                                                                </TableCell>
                                                                <TableCell className="text-right no-print">
                                                                    <Button
                                                                        type="button"
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-8 w-8 text-destructive hover:text-destructive"
                                                                        disabled={sending || loading || isRemoving}
                                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            onRemove(rowIdSafe);
                                                        }}
                                                                        title="Remove"
                                                                    >
                                                                        {isRemoving ? (
                                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                                        ) : (
                                                                            <X className="h-4 w-4" />
                                                                        )}
                                                                    </Button>
                                                                </TableCell>
                                                            </TableRow>
                                                        );
                                                    })
                                                )}
                                            </TableBody>
                                        </Table>
                                    </ScrollArea>
                                </div>

                                {/* ✅ Print signatory */}
                                <div className="mt-10 hidden print:block">
                                    <div className="text-sm font-medium">Received and Acknowledged by</div>
                                    <div className="mt-10 flex items-end justify-between gap-10">
                                        <div className="w-[320px]">
                                            <div className="border-t pt-2 text-sm">Name / Signature</div>
                                        </div>
                                        <div className="w-[220px] text-right">
                                            <div className="border-t pt-2 text-sm">Date</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Primary action */}
                                <div className="mt-4 flex justify-end no-print">
                                    <Button
                                        className="cursor-pointer gap-2 rounded-full px-6"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            onSendToPayment();
                                        }}
                                        disabled={sending || loading || !id}
                                    >
                                        {sending ? (
                                            <>
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                Sending…
                                            </>
                                        ) : (
                                            <>
                                                <Send className="h-4 w-4" />
                                                Confirm &amp; Send to Payment
                                            </>
                                        )}
                                    </Button>
                                </div>

                                <AddCCMDialog
                                    open={addOpen}
                                    onOpenChange={setAddOpen}
                                    transmittalId={id}
                                    supplierId={transmittal?.supplier_id ?? null}
                                    existingMemoIds={existingMemoIds}
                                    onAdded={() => {
                                        reload();
                                        onAfterUpdate();
                                    }}
                                />
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* ✅ Print CSS */}
                <style jsx global>{`
                    @media print {
                        .no-print {
                            display: none !important;
                        }
                        .print\\:block {
                            display: block !important;
                        }
                        /* Make sheet content behave like normal page during print */
                        [data-radix-dialog-overlay],
                        [data-radix-dialog-content] {
                            position: static !important;
                            inset: auto !important;
                            transform: none !important;
                            width: auto !important;
                            height: auto !important;
                            max-width: none !important;
                            max-height: none !important;
                            overflow: visible !important;
                            box-shadow: none !important;
                        }
                    }
                `}</style>
            </SheetContent>
        </Sheet>
    );
}