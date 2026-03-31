// src/modules/financial-management-system/claims-management/for-receiving/components/ForReceivingPage.tsx
"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { printTransmittalA4 } from "../utils/printTransmittalA4";
import { toast } from "sonner";
import { Loader2, Plus, RefreshCw, Search, Send, X } from "lucide-react";

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import type { TransmittalRow } from "../utils/types";
import { formatDateTime, formatPHP, toNumberSafe } from "../utils/format";

import { useTransmittals } from "../hooks/useTransmittals";
import { useTransmittalCounts } from "../hooks/useTransmittalCounts";
import { useTransmittalDetails } from "../hooks/useTransmittalDetails";

import AddCCMDialog from "./AddCCMDialog";
import { TransmittalDetailsSheet } from "./TransmittalDetailsSheet";
import * as api from "../providers/receivingApi";
import type { CompanyProfile } from "../utils/types";

type CCMDetailRow = {
    id: number;
    customer_memo_id?: number | null;
    memo_number?: string | null;

    credit_date?: string | null;
    created_at?: string | null;

    supplier_name?: string | null;
    customer_name?: string | null;

    gl_code?: string | null;
    account_title?: string | null;

    remarks?: string | null;
    reason?: string | null;

    total?: number | string | null;
    amount?: number | string | null;
};

type COAGroup = {
    key: string; // stable key
    label: string; // display label
    rows: CCMDetailRow[];
    subtotal: number;
};

function isRecord(v: unknown): v is Record<string, unknown> {
    return typeof v === "object" && v !== null;
}

/**
 * ✅ Fix for TS7053:
 * Always return a Record so string indexing is allowed.
 * (never fallback to `{}` without a type)
 */
function asRecord(v: unknown): Record<string, unknown> {
    return isRecord(v) ? v : ({} as Record<string, unknown>);
}

function safeMemoNo(memo_number: unknown, customer_memo_id: unknown) {
    const v = typeof memo_number === "string" ? memo_number.trim() : memo_number;
    if (!v || v === "null" || v === "undefined") return `CCM #${String(customer_memo_id ?? "")}`;
    return String(v);
}

function normalizeStatus(s?: string | null) {
    return (s ?? "").trim();
}

function safeText(v: unknown) {
    return typeof v === "string" ? v : v == null ? "" : String(v);
}

// ✅ string-or-null helper (prevents "{} | null" being passed to string props)
function safeStringOrNull(v: unknown): string | null {
    const s = safeText(v).trim();
    return s ? s : null;
}

function toNullableNumber(v: unknown): number | null {
    if (v == null) return null;
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : null;
}

function toMoneyLike(v: unknown): number | string | null {
    if (v == null) return null;
    if (typeof v === "number") return v;
    if (typeof v === "string") return v;
    // allow numeric-ish values (e.g. from DB drivers)
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}

function toCCMDetailRow(v: unknown): CCMDetailRow | null {
    if (!isRecord(v)) return null;

    const idNum = Number(v["id"]);
    if (!Number.isFinite(idNum) || idNum <= 0) return null;

    const customerMemoId = toNullableNumber(v["customer_memo_id"]);

    return {
        id: idNum,
        customer_memo_id: customerMemoId,
        memo_number: safeStringOrNull(v["memo_number"]),

        credit_date: typeof v["credit_date"] === "string" ? v["credit_date"] : null,
        created_at: typeof v["created_at"] === "string" ? v["created_at"] : null,

        supplier_name: typeof v["supplier_name"] === "string" ? v["supplier_name"] : null,
        customer_name: typeof v["customer_name"] === "string" ? v["customer_name"] : null,

        gl_code: typeof v["gl_code"] === "string" ? v["gl_code"] : null,
        account_title: typeof v["account_title"] === "string" ? v["account_title"] : null,

        remarks: typeof v["remarks"] === "string" ? v["remarks"] : null,
        reason: typeof v["reason"] === "string" ? v["reason"] : null,

        total: toMoneyLike(v["total"]),
        amount: toMoneyLike(v["amount"]),
    };
}

function coaLabelFor(r: CCMDetailRow): string {
    const title = safeText(r.account_title).trim();
    const code = safeText(r.gl_code).trim();

    if (title) return title;
    if (code) return code;
    return "—";
}

function coaKeyFor(r: CCMDetailRow): string {
    const code = safeText(r.gl_code).trim();
    const title = safeText(r.account_title).trim();
    return code || title || "—";
}

export default function ForReceivingPage() {
    const { rows, loading, error, reload } = useTransmittals({
        q: "",
        supplierId: null,
    });

    const [listQ, setListQ] = React.useState("");

    const filteredRows = React.useMemo(() => {
        const q = listQ.trim().toLowerCase();
        if (!q) return rows;

        return rows.filter((t) => {
            const rec = asRecord(t);

            const a = safeText(t.transmittal_no).toLowerCase();
            const b = safeText(t.supplier_name).toLowerCase();

            const c = safeText(rec["representative_name"]).toLowerCase();
            const d = safeText(rec["supplier_representative_name"]).toLowerCase();
            const e = safeText(rec["created_by_name"]).toLowerCase();

            return a.includes(q) || b.includes(q) || c.includes(q) || d.includes(q) || e.includes(q);
        });
    }, [rows, listQ]);

    const ids = React.useMemo(() => filteredRows.map((r) => r.id), [filteredRows]);
    const { counts } = useTransmittalCounts(ids);

    const [company, setCompany] = React.useState<CompanyProfile | null>(null);
    React.useEffect(() => {
        const ac = new AbortController();
        api.fetchCompanyProfile(ac.signal)
            .then(setCompany)
            .catch(() => setCompany(null));
        return () => ac.abort();
    }, []);

    const [activeId, setActiveId] = React.useState<number | null>(null);

    const active = React.useMemo<TransmittalRow | null>(() => {
        if (!activeId) return null;
        return filteredRows.find((r) => r.id === activeId) ?? null;
    }, [filteredRows, activeId]);

    React.useEffect(() => {
        if (!filteredRows.length) {
            setActiveId(null);
            return;
        }

        const stillExists = activeId != null && filteredRows.some((r) => r.id === activeId);
        if (stillExists) return;

        setActiveId(filteredRows[0].id);
    }, [filteredRows, activeId]);

    const [isMdUp, setIsMdUp] = React.useState(false);
    React.useEffect(() => {
        const mql = window.matchMedia("(min-width: 768px)");
        const onChange = () => setIsMdUp(mql.matches);
        onChange();
        mql.addEventListener("change", onChange);
        return () => mql.removeEventListener("change", onChange);
    }, []);

    const [sheetOpen, setSheetOpen] = React.useState(false);

    React.useEffect(() => {
        if (!isMdUp && active) setSheetOpen(true);
    }, [isMdUp, active]);

    const transmittalId = active?.id ?? null;

    const {
        rows: detailRowsRaw,
        loading: detailsLoading,
        error: detailsError,
        reload: reloadDetails,
    } = useTransmittalDetails(transmittalId ?? 0, !!transmittalId);

    const detailRows = React.useMemo<CCMDetailRow[]>(() => {
        const src = Array.isArray(detailRowsRaw) ? detailRowsRaw : [];
        const out: CCMDetailRow[] = [];
        for (const it of src) {
            const row = toCCMDetailRow(it);
            if (row) out.push(row);
        }
        return out;
    }, [detailRowsRaw]);

    const grouped = React.useMemo(() => {
        const map = new Map<string, COAGroup>();

        for (const r of detailRows) {
            const key = coaKeyFor(r);
            const label = coaLabelFor(r);
            const amt = toNumberSafe(r.total ?? r.amount);

            const g = map.get(key);
            if (!g) {
                map.set(key, { key, label, rows: [r], subtotal: amt });
            } else {
                g.rows.push(r);
                g.subtotal += amt;
                if (g.label === "—" && label !== "—") g.label = label;
            }
        }

        const groups = Array.from(map.values()).sort((a, b) =>
            a.label.localeCompare(b.label, undefined, { sensitivity: "base" })
        );

        for (const g of groups) {
            g.rows.sort((a, b) => {
                const am = safeText(a.memo_number).localeCompare(safeText(b.memo_number));
                if (am !== 0) return am;
                return a.id - b.id;
            });
        }

        const grandTotal = groups.reduce((sum, g) => sum + g.subtotal, 0);

        return { groups, grandTotal };
    }, [detailRows]);

    const [addOpen, setAddOpen] = React.useState(false);
    const [sending, setSending] = React.useState(false);
    const [busyRemove, setBusyRemove] = React.useState<number | null>(null);

    // ✅ Confirmation state for Send to Payment
    const [confirmSendOpen, setConfirmSendOpen] = React.useState(false);

    async function onRemoveLine(detailId: number) {
        if (sending) return;

        try {
            setBusyRemove(detailId);
            await api.removeDetailLine(detailId);
            toast.success("Removed CCM line.");
            reloadDetails?.();
            reload?.();
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : "Failed to remove line.";
            toast.error(msg);
        } finally {
            setBusyRemove(null);
        }
    }

    // ✅ Original logic moved here (unchanged)
    async function doSendToPayment() {
        if (!active) return;

        try {
            setSending(true);
            await api.sendTransmittalToPayment(active.id);
            toast.success("Sent to Payment.");

            setActiveId(null);
            await Promise.resolve(reload?.());
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : "Failed to send to payment.";
            toast.error(msg);
        } finally {
            setSending(false);
        }
    }

    // ✅ Button handler -> opens confirmation first
    function onSendClick() {
        if (!active) return;
        if (sending) return;
        if (detailsLoading) return;
        setConfirmSendOpen(true);
    }

    const ccmCount = detailRows.length;

    return (
        <div className="w-full min-w-0 space-y-4 p-4 md:p-6">
            {/* ✅ Confirm Send Dialog */}
            <AlertDialog open={confirmSendOpen} onOpenChange={setConfirmSendOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirm &amp; send to payment?</AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <div className="text-sm text-muted-foreground">
                                <div>This will move the selected transmittal to the payment processing stage.</div>

                                <div className="mt-3 space-y-1">
                                    <div>
                                        <span className="text-muted-foreground">CCM lines:</span>{" "}
                                        <span className="font-semibold text-foreground">{ccmCount}</span>
                                    </div>

                                    <div>
                                        <span className="text-muted-foreground">Grand Total:</span>{" "}
                                        <span className="font-semibold text-foreground">
                    {formatPHP(grouped.grandTotal)}
                </span>
                                    </div>

                                    <div className="pt-2 text-xs text-muted-foreground">
                                        Please confirm you want to proceed.
                                    </div>
                                </div>
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={sending}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="cursor-pointer"
                            disabled={sending}
                            onClick={async () => {
                                setConfirmSendOpen(false);
                                await doSendToPayment();
                            }}
                        >
                            {sending ? (
                                <span className="inline-flex items-center gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Sending…
                                </span>
                            ) : (
                                "Yes, proceed"
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <div className="space-y-1">
                <h1 className="text-2xl font-semibold tracking-tight">For Receiving</h1>
                <p className="text-sm text-muted-foreground">
                    Review and edit transmittals before payment processing
                </p>
            </div>

            <Card className="border-muted">
                <CardContent className="p-4 text-sm text-muted-foreground">
                    Review transmittals, add or remove CCMs as needed, then confirm to send to payment processing.
                </CardContent>
            </Card>

            <div
                className={cn(
                    "w-full min-w-0 gap-4",
                    isMdUp ? "grid min-h-0 h-[calc(100dvh-240px)]" : "grid grid-cols-1"
                )}
                style={
                    isMdUp
                        ? { gridTemplateColumns: "420px minmax(0, 1fr)", alignItems: "stretch" }
                        : undefined
                }
            >
                {/* LEFT */}
                <Card className="min-w-0 min-h-0 overflow-hidden flex flex-col">
                    <div className="p-4 shrink-0">
                        <div className="flex items-center justify-between gap-2">
                            <div className="text-sm font-semibold">Transmittals</div>
                            <div className="flex items-center gap-2">
                                <Badge variant="outline" className="font-mono">
                                    {loading ? "…" : `${filteredRows.length}`}
                                </Badge>

                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="cursor-pointer"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        reload?.();
                                    }}
                                    disabled={loading}
                                >
                                    <RefreshCw className={loading ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} />
                                    Refresh
                                </Button>
                            </div>
                        </div>

                        <div className="mt-3 relative">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                value={listQ}
                                onChange={(e) => setListQ(e.target.value)}
                                placeholder="Search TRN / supplier / rep…"
                                className="pl-9"
                            />
                        </div>

                        <div className="mt-2 text-xs text-muted-foreground">Awaiting review</div>
                    </div>

                    <Separator />

                    <ScrollArea className="flex-1 min-h-0">
                        <div className="space-y-2 p-4">
                            {loading ? (
                                <Card className="p-4 text-sm text-muted-foreground">Loading…</Card>
                            ) : error ? (
                                <Card className="border-destructive/30 bg-destructive/5 p-4">
                                    <div className="text-sm font-medium text-destructive">Failed to load</div>
                                    <div className="mt-1 text-sm text-muted-foreground">{String(error)}</div>
                                </Card>
                            ) : filteredRows.length === 0 ? (
                                <Card className="p-6 text-center text-sm text-muted-foreground">
                                    No transmittals found.
                                </Card>
                            ) : (
                                filteredRows.map((t) => {
                                    const isActiveRow = t.id === activeId;

                                    const supplier =
                                        safeText(t.supplier_name).trim() ||
                                        (t.supplier_id ? `Supplier #${t.supplier_id}` : "—");

                                    const rec = asRecord(t);
                                    const repRaw =
                                        rec["representative_name"] ??
                                        rec["supplier_representative_name"] ??
                                        (rec["supplier_representative_id"]
                                            ? `Rep #${String(rec["supplier_representative_id"])}`
                                            : "");

                                    const rep = safeText(repRaw).trim();

                                    const count = counts?.[t.id];

                                    const trnNo = safeText(t.transmittal_no).trim() || `TRN-${t.id}`;

                                    return (
                                        <button
                                            key={t.id}
                                            type="button"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setActiveId(t.id);
                                                if (!isMdUp) setSheetOpen(true);
                                            }}
                                            className={cn(
                                                "w-full rounded-xl border bg-background p-4 text-left transition",
                                                "hover:bg-muted/50",
                                                isActiveRow && "border-foreground/30 ring-1 ring-foreground/10"
                                            )}
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <div className="font-mono text-sm font-semibold">{trnNo}</div>
                                                    <div className="mt-1 truncate text-sm text-muted-foreground">
                                                        {supplier}
                                                    </div>

                                                    {rep ? (
                                                        <div className="mt-1 truncate text-xs text-muted-foreground">
                                                            {rep}
                                                        </div>
                                                    ) : null}

                                                    <div className="mt-2 text-xs text-muted-foreground">
                                                        {typeof count === "number" ? `${count} CCMs` : "CCMs…"}
                                                    </div>
                                                </div>

                                                <div className="shrink-0 text-right">
                                                    <Badge variant="secondary" className="rounded-full">
                                                        FOR RECEIVING
                                                    </Badge>

                                                    <div className="mt-2 text-xs text-muted-foreground">Total</div>
                                                    <div className="font-mono text-sm font-semibold">
                                                        {formatPHP(toNumberSafe(t.total_amount))}
                                                    </div>
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </ScrollArea>
                </Card>

                {/* RIGHT */}
                <div className="min-w-0 min-h-0 overflow-hidden flex flex-col gap-4">
                    {!active ? (
                        <Card className="p-10 text-center text-sm text-muted-foreground">
                            Select a transmittal on the left to view details.
                        </Card>
                    ) : (
                        <>
                            <ScrollArea className="flex-1 min-h-0">
                                <div className="min-w-0 space-y-4 pr-1">
                                    <Card className="min-w-0">
                                        <div className="p-6">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <div className="text-sm font-semibold">Transmittal Details</div>
                                                    <div className="mt-1 text-sm text-muted-foreground">
                                                        Rec No:{" "}
                                                        <span className="font-mono text-foreground">
                                                            {safeText(active.transmittal_no).trim() || `TRN-${active.id}`}
                                                        </span>
                                                    </div>
                                                </div>

                                                <Badge className="rounded-full" variant="secondary">
                                                    {normalizeStatus(active.status) || "FOR RECEIVING"}
                                                </Badge>

                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className="cursor-pointer ml-2"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        try {
                                                            const rec = asRecord(active);
                                                            const createdByName = safeStringOrNull(rec["created_by_name"]);

                                                            printTransmittalA4({
                                                                header: {
                                                                    ...active,
                                                                    created_by_name: createdByName,
                                                                },
                                                                lines: detailRows,
                                                                company,
                                                            });
                                                        } catch (e: unknown) {
                                                            toast.error(e instanceof Error ? e.message : "Failed to print.");
                                                        }
                                                    }}
                                                >
                                                    Print
                                                </Button>
                                            </div>

                                            <Separator className="my-5" />

                                            <div className="grid gap-4 md:grid-cols-2">
                                                <div className="space-y-1">
                                                    <div className="text-xs text-muted-foreground">Supplier</div>
                                                    <div className="truncate text-sm font-semibold">
                                                        {safeText(active.supplier_name).trim() ||
                                                            (active.supplier_id ? `Supplier #${active.supplier_id}` : "—")}
                                                    </div>
                                                </div>

                                                <div className="space-y-1">
                                                    <div className="text-xs text-muted-foreground">Representative</div>
                                                    <div className="truncate text-sm font-semibold">
                                                        {(() => {
                                                            const rec = asRecord(active);
                                                            const repRaw =
                                                                rec["representative_name"] ??
                                                                rec["supplier_representative_name"] ??
                                                                (rec["supplier_representative_id"]
                                                                    ? `Rep #${String(rec["supplier_representative_id"])}`
                                                                    : "—");
                                                            return safeText(repRaw).trim() || "—";
                                                        })()}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="mt-4 text-xs text-muted-foreground space-y-1">
                                                <div>
                                                    Created:{" "}
                                                    <span className="text-foreground">
                                                        {typeof active.created_at === "string"
                                                            ? formatDateTime(active.created_at)
                                                            : "—"}
                                                    </span>
                                                </div>

                                                <div>
                                                    Created by:{" "}
                                                    <span className="text-foreground font-medium">
                                                        {(() => {
                                                            const rec = asRecord(active);
                                                            const s = safeText(rec["created_by_name"]).trim();
                                                            return s || "—";
                                                        })()}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </Card>

                                    {/* CCM list card */}
                                    <Card className="min-w-0 overflow-hidden">
                                        <CardHeader className="flex flex-row items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <CardTitle className="text-base">Customer Credit Memos</CardTitle>
                                                <div className="mt-1 text-sm text-muted-foreground">
                                                    {detailsLoading ? "Loading…" : `${ccmCount} CCM(s) in this transmittal`}
                                                </div>
                                            </div>

                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="shrink-0 cursor-pointer"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    setAddOpen(true);
                                                }}
                                                disabled={sending || detailsLoading}
                                            >
                                                <Plus className="mr-2 h-4 w-4" />
                                                Add CCM
                                            </Button>
                                        </CardHeader>

                                        <Separator />

                                        <CardContent className="min-w-0 p-0">
                                            {detailsError ? (
                                                <div className="p-6 text-sm text-destructive">{String(detailsError)}</div>
                                            ) : null}

                                            <div className="rounded-xl border m-6 mt-5">
                                                <ScrollArea className="h-[340px] w-full">
                                                    <div className="w-full overflow-x-auto">
                                                        <div className="min-w-[1280px]">
                                                            <Table>
                                                                <TableHeader className="sticky top-0 z-10 bg-background">
                                                                    <TableRow>
                                                                        <TableHead className="w-[160px]">Chart of Accounts</TableHead>
                                                                        <TableHead className="w-[160px]">Credit Date</TableHead>
                                                                        <TableHead className="w-[200px]">Credit Memo No.</TableHead>
                                                                        <TableHead className="w-[220px]">Supplier</TableHead>
                                                                        <TableHead className="w-[260px]">Customer Name</TableHead>
                                                                        <TableHead className="w-[420px]">Remarks</TableHead>
                                                                        <TableHead className="w-[140px] text-right">Total</TableHead>
                                                                        <TableHead className="w-[56px]" />
                                                                    </TableRow>
                                                                </TableHeader>

                                                                <TableBody>
                                                                    {detailsLoading ? (
                                                                        <TableRow>
                                                                            <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                                                                                <span className="inline-flex items-center gap-2">
                                                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                                                    Loading CCMs…
                                                                                </span>
                                                                            </TableCell>
                                                                        </TableRow>
                                                                    ) : detailRows.length === 0 ? (
                                                                        <TableRow>
                                                                            <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                                                                                No CCM lines.
                                                                            </TableCell>
                                                                        </TableRow>
                                                                    ) : (
                                                                        <>
                                                                            {grouped.groups.map((g) => (
                                                                                <React.Fragment key={g.key}>
                                                                                    <TableRow className="bg-muted/40">
                                                                                        <TableCell colSpan={9} className="py-3">
                                                                                            <div className="flex items-center justify-between gap-3">
                                                                                                <div className="min-w-0">
                                                                                                    <div className="text-xs text-muted-foreground">
                                                                                                        Chart of Accounts
                                                                                                    </div>
                                                                                                    <div className="truncate font-semibold">{g.label}</div>
                                                                                                </div>

                                                                                            </div>
                                                                                        </TableCell>
                                                                                    </TableRow>

                                                                                    {g.rows.map((r) => {
                                                                                        const isRemoving = busyRemove === Number(r.id);
                                                                                        const creditDate = r.credit_date ?? r.created_at ?? null;

                                                                                        const supplier = safeText(r.supplier_name).trim() || "—";
                                                                                        const customer = safeText(r.customer_name).trim() || "—";
                                                                                        const coa = coaLabelFor(r);

                                                                                        const remarks =
                                                                                            safeText(r.remarks).trim() ||
                                                                                            safeText(r.reason).trim() ||
                                                                                            "—";

                                                                                        const total = toNumberSafe(r.total ?? r.amount);

                                                                                        return (
                                                                                            <TableRow key={r.id}>
                                                                                                <TableCell className="text-sm">{coa}</TableCell>
                                                                                                <TableCell>
                                                                                                    {creditDate ? formatDateTime(creditDate) : "—"}
                                                                                                </TableCell>

                                                                                                <TableCell className="font-medium">
                                                                                                    {safeMemoNo(r.memo_number, r.customer_memo_id)}
                                                                                                </TableCell>

                                                                                                <TableCell className="text-sm text-muted-foreground">{supplier}</TableCell>
                                                                                                <TableCell className="text-sm text-muted-foreground">{customer}</TableCell>

                                                                                                <TableCell className="text-sm text-muted-foreground">
                                                                                                    <div className="line-clamp-2">{remarks}</div>
                                                                                                </TableCell>

                                                                                                <TableCell className="text-right font-medium">
                                                                                                    {formatPHP(total)}
                                                                                                </TableCell>

                                                                                                <TableCell className="text-right">
                                                                                                    <Button
                                                                                                        variant="ghost"
                                                                                                        size="icon"
                                                                                                        className="cursor-pointer text-destructive hover:text-destructive"
                                                                                                        type="button" onClick={(e) => {
                                                                                e.preventDefault();
                                                                                e.stopPropagation();
                                                                                onRemoveLine(Number(r.id));
                                                                            }}
                                                                                                        disabled={sending || detailsLoading || isRemoving}
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
                                                                                    })}

                                                                                    <TableRow className="bg-muted/20">
                                                                                        <TableCell colSpan={6} className="py-3 text-right text-sm text-muted-foreground">
                                                                                            Subtotal — {g.label}
                                                                                        </TableCell>
                                                                                        <TableCell className="py-3 text-right font-semibold">
                                                                                            {formatPHP(g.subtotal)}
                                                                                        </TableCell>
                                                                                        <TableCell colSpan={2} />
                                                                                    </TableRow>
                                                                                </React.Fragment>
                                                                            ))}

                                                                            <TableRow className="bg-background">
                                                                                <TableCell colSpan={6} className="py-4 text-right text-sm font-semibold">
                                                                                    GRAND TOTAL
                                                                                </TableCell>
                                                                                <TableCell className="py-4 text-right text-sm font-semibold">
                                                                                    {formatPHP(grouped.grandTotal)}
                                                                                </TableCell>
                                                                                <TableCell colSpan={2} />
                                                                            </TableRow>
                                                                        </>
                                                                    )}
                                                                </TableBody>
                                                            </Table>
                                                        </div>
                                                    </div>

                                                    <ScrollBar orientation="horizontal" />
                                                </ScrollArea>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>

                                <ScrollBar orientation="horizontal" />
                            </ScrollArea>

                            <Card className="shrink-0 min-w-0 overflow-hidden border bg-background">
                                <div className="p-4 md:p-5">
                                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                        {/* LEFT KPIs */}
                                        <div className="flex items-center gap-4">
                                            <div>
                                                <div className="text-xs text-muted-foreground">CCMs</div>
                                                <div className="text-2xl font-semibold">{ccmCount}</div>
                                            </div>

                                            <div className="h-10 w-px bg-border" />

                                            <div>
                                                <div className="text-xs text-muted-foreground">Grand Total (Lines)</div>
                                                <div className="text-2xl font-semibold">{formatPHP(grouped.grandTotal)}</div>
                                            </div>
                                        </div>

                                        {/* RIGHT Actions */}
                                        <div className="flex md:justify-end">
                                            <Button
                                                type="button"
                                                className={cn(
                                                    "h-12 rounded-xl px-6 md:w-auto md:min-w-[280px] cursor-pointer",
                                                    "justify-center"
                                                )}
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    onSendClick();
                                                }}
                                                disabled={sending || detailsLoading || !active}
                                            >
                                                {sending ? (
                                                    <>
                                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                        Sending…
                                                    </>
                                                ) : (
                                                    <>
                                                        <Send className="mr-2 h-4 w-4" />
                                                        Confirm &amp; Send to Payment
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </Card>

                            <AddCCMDialog
                                open={addOpen}
                                onOpenChange={setAddOpen}
                                transmittalId={active.id}
                                supplierId={active.supplier_id ?? null}
                                existingMemoIds={detailRows
                                    .map((d) => Number(d.customer_memo_id))
                                    .filter((n) => Number.isFinite(n) && n > 0)}
                                onAdded={() => {
                                    setAddOpen(false);
                                    reloadDetails?.();
                                    reload?.();
                                }}
                            />
                        </>
                    )}
                </div>
            </div>

            {!isMdUp ? (
                <TransmittalDetailsSheet
                    open={sheetOpen}
                    onOpenChange={setSheetOpen}
                    transmittal={active}
                    onAfterUpdate={() => {
                        reloadDetails?.();
                        reload?.();
                    }}
                />
            ) : null}
        </div>
    );
}
