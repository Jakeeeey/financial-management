// src/modules/financial-management/claims-management/for-payment/components/ForPaymentPage.tsx
"use client";

import * as React from "react";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Search } from "lucide-react";

import type { CompanyProfile } from "../utils/printTransmittalPaymentA4";
import {
    fetchCompanyProfile,
    markTransmittalPosted,
    updateCustomerMemoFlags,
} from "../providers/paymentApi";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
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

import { cn } from "@/lib/utils";

import { usePaymentTransmittals } from "../hooks/usePaymentTransmittals";
import { usePaymentTransmittalDetails } from "../hooks/usePaymentTransmittalDetails";
import { formatDateTime, formatPHP, toNumberSafe } from "../utils/format";
import type { TransmittalDetailRow, TransmittalRow } from "../utils/types";
import { printTransmittalPaymentA4 } from "../utils/printTransmittalPaymentA4";

/* ================= Helpers ================= */

function normalizeStatus(s?: string | null) {
    return (s ?? "").trim();
}

function safeText(v: unknown) {
    return typeof v === "string" ? v : v == null ? "" : String(v);
}

function uniqNums(values: Array<unknown>) {
    const out: number[] = [];
    const seen = new Set<number>();
    for (const v of values) {
        const n = typeof v === "number" ? v : Number(v);
        if (!Number.isFinite(n) || n <= 0) continue;
        if (seen.has(n)) continue;
        seen.add(n);
        out.push(n);
    }
    return out;
}

type COAGroup = {
    key: string;
    label: string;
    rows: TransmittalDetailRow[];
    subtotalSelected: number; // subtotal of selected rows only
    subtotalAll: number; // subtotal of all rows in group
};

function safeCoaLabel(r: TransmittalDetailRow): string {
    const gl = safeText(r.gl_code).trim();
    const title = safeText(r.account_title).trim();
    if (title) return title;
    if (gl) return gl;
    return "—";
}

function safeCoaKey(r: TransmittalDetailRow): string {
    const gl = safeText(r.gl_code).trim();
    const title = safeText(r.account_title).trim();
    return gl || title || "—";
}

function safeRemarks(r: TransmittalDetailRow): string {
    const a = safeText(r.remarks).trim();
    const b = safeText(r.reason).trim();
    return a || b || "—";
}

function safeMemoNo(m: unknown, id: unknown) {
    const v = safeText(m).trim();
    if (!v || v === "null" || v === "undefined") return `CCM #${String(id ?? "")}`;
    return v;
}

/* ================= Component ================= */

export default function ForPaymentPage() {
    const { rows, loading, error, reload } = usePaymentTransmittals();
    const [company, setCompany] = React.useState<CompanyProfile | null>(null);

    React.useEffect(() => {
        fetchCompanyProfile()
            .then(setCompany)
            .catch(() => setCompany(null));
    }, []);

    // Left list search (client-side)
    const [listQ, setListQ] = React.useState("");

    const filteredRows = React.useMemo(() => {
        const q = listQ.trim().toLowerCase();
        if (!q) return rows;

        return rows.filter((t) => {
            const a = safeText(t.transmittal_no).toLowerCase();
            const b = safeText(t.supplier_name).toLowerCase();
            const c = safeText(t.representative_name).toLowerCase();
            return a.includes(q) || b.includes(q) || c.includes(q);
        });
    }, [rows, listQ]);

    const [activeId, setActiveId] = React.useState<number | null>(null);

    const active = React.useMemo<TransmittalRow | null>(() => {
        return filteredRows.find((r) => r.id === activeId) ?? null;
    }, [filteredRows, activeId]);

    // auto-select first item when list is ready / search changes
    React.useEffect(() => {
        if (filteredRows.length === 0) {
            setActiveId(null);
            return;
        }

        const stillExists = filteredRows.some((r) => r.id === activeId);
        if (stillExists) return;

        setActiveId(filteredRows[0].id);
    }, [filteredRows, activeId]);

    const {
        rows: details,
        loading: dLoading,
        error: dError,
        reload: reloadDetails,
    } = usePaymentTransmittalDetails(activeId, !!activeId);

    // Selected detail IDs
    const [selectedIds, setSelectedIds] = React.useState<Set<number>>(new Set());

    React.useEffect(() => {
        setSelectedIds(new Set());
    }, [activeId]);

    // auto-select all on first load of details (only if user hasn't chosen yet)
    React.useEffect(() => {
        if (!activeId) return;
        if (!details?.length) return;

        setSelectedIds((prev) => {
            if (prev.size > 0) return prev;
            return new Set(details.map((d) => d.id));
        });
    }, [activeId, details]);

    const includedRows = React.useMemo<TransmittalDetailRow[]>(() => {
        if (!details?.length) return [];
        return details.filter((d) => selectedIds.has(d.id));
    }, [details, selectedIds]);

    const includedCount = includedRows.length;

    const grandTotal = React.useMemo(() => {
        return includedRows.reduce((acc, r) => acc + toNumberSafe(r.amount), 0);
    }, [includedRows]);

    const totalDetails = details?.length ?? 0;

    const allChecked = totalDetails > 0 && selectedIds.size === totalDetails;
    const anyChecked = selectedIds.size > 0;

    const headerChecked: boolean | "indeterminate" =
        allChecked ? true : anyChecked ? "indeterminate" : false;

    async function applyMemoFlagsForRow(row: TransmittalDetailRow, included: boolean) {
        const memoId = Number(row.customer_memo_id);
        if (!memoId) return;

        await updateCustomerMemoFlags({
            memoId,
            isPending: included ? 1 : 0,
            isClaimed: 0,
        });
    }

    async function toggleAll(checked: boolean) {
        if (!details?.length) return;

        setSelectedIds(() => {
            if (!checked) return new Set();
            return new Set(details.map((d) => d.id));
        });

        try {
            await Promise.all(details.map((d) => applyMemoFlagsForRow(d, checked)));
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : String(e));
        }
    }

    async function toggleOne(id: number, checked: boolean) {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (checked) next.add(id);
            else next.delete(id);
            return next;
        });

        const row = details?.find((x) => x.id === id);
        if (!row) return;

        try {
            await applyMemoFlagsForRow(row, checked);
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : String(e));
        }
    }

    const grouped = React.useMemo(() => {
        const src = Array.isArray(details) ? details : [];
        const map = new Map<string, COAGroup>();

        for (const r of src) {
            const key = safeCoaKey(r);
            const label = safeCoaLabel(r);
            const amt = toNumberSafe(r.amount);
            const isSel = selectedIds.has(r.id);

            const g = map.get(key);
            if (!g) {
                map.set(key, {
                    key,
                    label,
                    rows: [r],
                    subtotalSelected: isSel ? amt : 0,
                    subtotalAll: amt,
                });
            } else {
                g.rows.push(r);
                g.subtotalAll += amt;
                if (isSel) g.subtotalSelected += amt;
                if (g.label === "—" && label !== "—") g.label = label;
            }
        }

        const groups = Array.from(map.values()).sort((a, b) =>
            a.label.localeCompare(b.label, undefined, { sensitivity: "base" })
        );

        for (const g of groups) {
            g.rows.sort((a, b) =>
                safeText(a.memo_number).localeCompare(safeText(b.memo_number))
            );
        }

        return groups;
    }, [details, selectedIds]);

    const [posting, setPosting] = React.useState(false);

    // ✅ Confirmation dialog state
    const [confirmOpen, setConfirmOpen] = React.useState(false);

    // ✅ Real posting logic (previous onPost)
    async function doPost() {
        if (!activeId) return;
        if (!anyChecked) return;

        try {
            setPosting(true);

            const includedMemoIds = uniqNums(
                (details ?? [])
                    .filter((d) => selectedIds.has(d.id))
                    .map((d) => d.customer_memo_id)
            );

            const excludedMemoIds = uniqNums(
                (details ?? [])
                    .filter((d) => !selectedIds.has(d.id))
                    .map((d) => d.customer_memo_id)
            );

            await markTransmittalPosted({
                transmittalId: activeId,
                includedMemoIds,
                excludedMemoIds,
            });

            toast.success("Transmittal posted.");

            setActiveId(null);
            setSelectedIds(new Set());

            await reload();
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : String(e));
        } finally {
            setPosting(false);
        }
    }

    // ✅ Click handler: open confirmation first
    function onPostClick() {
        if (!activeId) return;
        if (!anyChecked) return;
        if (posting) return;
        setConfirmOpen(true);
    }

    return (
        <div className="w-full min-w-0 space-y-4 p-4 md:p-6">
            {/* ✅ Confirmation Dialog */}
            <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Proceed with posting?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will post the transmittal and update CCM flags.
                        </AlertDialogDescription>

                        <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                            <div>
                                <span className="text-muted-foreground">Selected CCMs:</span>{" "}
                                <span className="font-semibold text-foreground">{includedCount}</span>
                            </div>
                            <div>
                                <span className="text-muted-foreground">Grand Total:</span>{" "}
                                <span className="font-semibold text-foreground">
                {formatPHP(grandTotal)}
            </span>
                            </div>
                            <div className="pt-2 text-xs text-muted-foreground">
                                Please confirm you want to proceed.
                            </div>
                        </div>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={posting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="cursor-pointer"
                            disabled={posting}
                            onClick={async () => {
                                setConfirmOpen(false);
                                await doPost();
                            }}
                        >
                            {posting ? (
                                <span className="inline-flex items-center gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Posting…
                                </span>
                            ) : (
                                "Yes, proceed"
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Header */}
            <div className="space-y-1">
                <h1 className="text-2xl font-semibold tracking-tight">For Payment</h1>
                <p className="text-sm text-muted-foreground">
                    Review and post transmittals for payment
                </p>
            </div>

            {/* Layout */}
            <div
                className="grid w-full min-w-0 gap-4 md:min-h-0"
                style={{ gridTemplateColumns: "360px minmax(0, 1fr)" }}
            >
                {/* Left column */}
                <Card className="min-w-0 overflow-hidden">
                    <div className="p-4">
                        <div className="flex items-center justify-between gap-2">
                            <div className="text-sm font-semibold">Transmittals</div>
                            <Badge variant="outline" className="font-mono">
                                {loading ? "…" : `${filteredRows.length}`}
                            </Badge>
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
                    </div>

                    <Separator />

                    <ScrollArea className="max-h-[520px] md:max-h-[calc(100vh-240px)]">
                        <div className="space-y-2 p-4">
                            {loading ? (
                                <Card className="p-4 text-sm text-muted-foreground">Loading…</Card>
                            ) : error ? (
                                <Card className="border-destructive/30 bg-destructive/5 p-4">
                                    <div className="text-sm font-medium text-destructive">Failed to load</div>
                                    <div className="mt-1 text-sm text-muted-foreground">
                                        {String(error)}
                                    </div>

                                    <div className="mt-3">
                                        <Button size="sm" variant="outline" onClick={() => reload()}>
                                            Retry
                                        </Button>
                                    </div>
                                </Card>
                            ) : filteredRows.length === 0 ? (
                                <Card className="p-6 text-center text-sm text-muted-foreground">
                                    No transmittals found.
                                </Card>
                            ) : (
                                filteredRows.map((t) => {
                                    const isActive = t.id === activeId;

                                    const supplier =
                                        safeText(t.supplier_name).trim() ||
                                        (t.supplier_id ? `Supplier #${t.supplier_id}` : "—");

                                    const rep =
                                        safeText(t.representative_name).trim() ||
                                        (t.supplier_representative_id
                                            ? `Rep #${t.supplier_representative_id}`
                                            : "—");

                                    const total =
                                        t.total_amount != null ? toNumberSafe(t.total_amount) : null;

                                    return (
                                        <button
                                            key={t.id}
                                            type="button"
                                            onClick={() => setActiveId(t.id)}
                                            className={cn(
                                                "w-full rounded-xl border bg-background p-4 text-left transition",
                                                "hover:bg-muted/50",
                                                isActive && "border-foreground/30 ring-1 ring-foreground/10"
                                            )}
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <div className="font-mono text-sm font-semibold">
                                                        {safeText(t.transmittal_no).trim() || `TRN-${t.id}`}
                                                    </div>
                                                    <div className="mt-1 truncate text-sm text-muted-foreground">
                                                        {supplier}
                                                    </div>
                                                    <div className="mt-1 truncate text-xs text-muted-foreground">
                                                        {rep}
                                                    </div>
                                                </div>

                                                <div className="shrink-0 text-right">
                                                    <Badge variant="secondary" className="rounded-full">
                                                        FOR PAYMENT
                                                    </Badge>

                                                    {total != null ? (
                                                        <div className="mt-2 font-mono text-xs font-semibold">
                                                            {formatPHP(total)}
                                                        </div>
                                                    ) : null}
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </ScrollArea>
                </Card>

                {/* Right column */}
                <div className="min-w-0 space-y-4">
                    {!active ? (
                        <Card className="p-10 text-center text-sm text-muted-foreground">
                            Select a transmittal on the left to view details.
                        </Card>
                    ) : (
                        <>
                            {/* Details card */}
                            <Card className="min-w-0">
                                <div className="p-6">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="text-sm font-semibold">Transmittal Details</div>
                                            <div className="mt-1 text-sm text-muted-foreground">
                                                Rec No:{" "}
                                                <span className="font-mono text-foreground">
                                                    {safeText(active.transmittal_no).trim() ||
                                                        `TRN-${active.id}`}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <Badge className="rounded-full" variant="secondary">
                                                {normalizeStatus(active.status) || "—"}
                                            </Badge>

                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="cursor-pointer"
                                                onClick={() => {
                                                    // print ONLY included lines (selected)
                                                    printTransmittalPaymentA4({
                                                        header: {
                                                            ...active,
                                                            created_by_name: active.created_by_name ?? null,
                                                            total_amount: grandTotal, // ensure print total matches selection
                                                        },
                                                        lines: includedRows,
                                                        company,
                                                    });
                                                }}
                                                disabled={dLoading || includedRows.length === 0}
                                                title={
                                                    includedRows.length === 0
                                                        ? "No selected lines to print"
                                                        : "Print"
                                                }
                                            >
                                                Print
                                            </Button>
                                        </div>
                                    </div>

                                    <Separator className="my-5" />

                                    <div className="grid gap-4 md:grid-cols-2">
                                        <div className="space-y-1">
                                            <div className="text-xs text-muted-foreground">Supplier</div>
                                            <div className="truncate text-sm font-semibold">
                                                {safeText(active.supplier_name).trim() ||
                                                    (active.supplier_id
                                                        ? `Supplier #${active.supplier_id}`
                                                        : "—")}
                                            </div>
                                        </div>

                                        <div className="space-y-1">
                                            <div className="text-xs text-muted-foreground">
                                                Representative
                                            </div>
                                            <div className="truncate text-sm font-semibold">
                                                {safeText(active.representative_name).trim() ||
                                                    (active.supplier_representative_id
                                                        ? `Rep #${active.supplier_representative_id}`
                                                        : "—")}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-4 text-xs text-muted-foreground space-y-1">
                                        <div>
                                            Created:{" "}
                                            <span className="text-foreground">
                                                {active.created_at
                                                    ? formatDateTime(active.created_at)
                                                    : "—"}
                                            </span>
                                        </div>

                                        <div>
                                            Created by:{" "}
                                            <span className="text-foreground font-medium">
                                                {safeText(active.created_by_name).trim() || "—"}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </Card>

                            {/* CCM list card */}
                            <Card className="min-w-0">
                                <div className="p-6">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="text-sm font-semibold">
                                                Customer Credit Memos
                                            </div>
                                            <div className="mt-1 text-sm text-muted-foreground">
                                                {dLoading
                                                    ? "Loading…"
                                                    : `${totalDetails} CCM(s) in this transmittal`}
                                            </div>
                                        </div>

                                        <Badge variant="outline" className="font-mono">
                                            Selected {selectedIds.size}/{totalDetails}
                                        </Badge>
                                    </div>

                                    <Separator className="my-5" />

                                    {dError ? (
                                        <Card className="mb-4 border-destructive/30 bg-destructive/5 p-4">
                                            <div className="text-sm font-medium text-destructive">
                                                Failed to load CCMs
                                            </div>
                                            <div className="mt-1 text-sm text-muted-foreground">
                                                {String(dError)}
                                            </div>
                                            <div className="mt-3">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => reloadDetails()}
                                                    disabled={dLoading}
                                                >
                                                    Retry
                                                </Button>
                                            </div>
                                        </Card>
                                    ) : null}

                                    <div className="rounded-xl border">
                                        <ScrollArea className="h-[340px] w-full">
                                            <div className="min-w-[1320px]">
                                                <Table className="w-full">
                                                    <TableHeader className="sticky top-0 z-10 bg-background">
                                                        <TableRow>
                                                            <TableHead className="w-[90px] whitespace-nowrap">
                                                                <div className="flex items-center gap-2">
                                                                    <Checkbox
                                                                        checked={headerChecked}
                                                                        onCheckedChange={(v) =>
                                                                            toggleAll(Boolean(v))
                                                                        }
                                                                        disabled={
                                                                            dLoading ||
                                                                            posting ||
                                                                            totalDetails === 0
                                                                        }
                                                                    />
                                                                    <span className="text-xs text-muted-foreground">
                                                                        All
                                                                    </span>
                                                                </div>
                                                            </TableHead>

                                                            <TableHead className="w-[180px] whitespace-nowrap">
                                                                Chart of Accounts
                                                            </TableHead>
                                                            <TableHead className="w-[170px] whitespace-nowrap">
                                                                Date Received
                                                            </TableHead>
                                                            <TableHead className="w-[180px] whitespace-nowrap">
                                                                Credit Memo No.
                                                            </TableHead>
                                                            <TableHead className="w-[260px] whitespace-nowrap">
                                                                Customer Name
                                                            </TableHead>
                                                            <TableHead className="w-[420px] whitespace-nowrap">
                                                                Remarks
                                                            </TableHead>
                                                            <TableHead className="w-[140px] whitespace-nowrap text-right">
                                                                Total
                                                            </TableHead>
                                                        </TableRow>
                                                    </TableHeader>

                                                    <TableBody>
                                                        {dLoading ? (
                                                            <TableRow>
                                                                <TableCell
                                                                    colSpan={7}
                                                                    className="py-10 text-center text-sm text-muted-foreground"
                                                                >
                                                                    <span className="inline-flex items-center gap-2">
                                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                                        Loading CCMs…
                                                                    </span>
                                                                </TableCell>
                                                            </TableRow>
                                                        ) : !details?.length ? (
                                                            <TableRow>
                                                                <TableCell
                                                                    colSpan={7}
                                                                    className="py-10 text-center text-sm text-muted-foreground"
                                                                >
                                                                    No CCMs found.
                                                                </TableCell>
                                                            </TableRow>
                                                        ) : (
                                                            <>
                                                                {grouped.map((g) => (
                                                                    <React.Fragment key={g.key}>
                                                                        {/* Group header */}
                                                                        <TableRow className="bg-muted/40">
                                                                            <TableCell colSpan={7} className="py-3">
                                                                                <div className="flex items-center justify-between gap-3">
                                                                                    <div className="min-w-0">
                                                                                        <div className="text-xs text-muted-foreground">
                                                                                            Chart of Accounts
                                                                                        </div>
                                                                                        <div className="truncate font-semibold">
                                                                                            {g.label}
                                                                                        </div>
                                                                                    </div>

                                                                                </div>
                                                                            </TableCell>
                                                                        </TableRow>

                                                                        {g.rows.map((d) => {
                                                                            const checked = selectedIds.has(d.id);
                                                                            const receivedAt = d.received_at
                                                                                ? formatDateTime(d.received_at)
                                                                                : "—";

                                                                            return (
                                                                                <TableRow
                                                                                    key={d.id}
                                                                                    className={cn(!checked && "opacity-60")}
                                                                                >
                                                                                    <TableCell className="whitespace-nowrap">
                                                                                        <Checkbox
                                                                                            checked={checked}
                                                                                            onCheckedChange={(v) =>
                                                                                                toggleOne(d.id, Boolean(v))
                                                                                            }
                                                                                            disabled={posting}
                                                                                        />
                                                                                    </TableCell>

                                                                                    <TableCell className="text-sm whitespace-nowrap">
                                                                                        {safeCoaLabel(d)}
                                                                                    </TableCell>

                                                                                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                                                                        {receivedAt}
                                                                                    </TableCell>

                                                                                    <TableCell className="font-mono text-xs whitespace-nowrap">
                                                                                        {safeMemoNo(
                                                                                            d.memo_number,
                                                                                            d.customer_memo_id
                                                                                        )}
                                                                                    </TableCell>

                                                                                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                                                                                        {safeText(d.customer_name).trim() || "—"}
                                                                                    </TableCell>

                                                                                    <TableCell className="text-sm text-muted-foreground">
                                                                                        <div className="line-clamp-2">
                                                                                            {safeRemarks(d)}
                                                                                        </div>
                                                                                    </TableCell>

                                                                                    <TableCell className="text-right font-mono text-xs whitespace-nowrap">
                                                                                        {formatPHP(toNumberSafe(d.amount))}
                                                                                    </TableCell>
                                                                                </TableRow>
                                                                            );
                                                                        })}

                                                                        {/* Group subtotal row */}
                                                                        <TableRow className="bg-muted/20">
                                                                            <TableCell
                                                                                colSpan={6}
                                                                                className="py-3 text-right text-sm text-muted-foreground"
                                                                            >
                                                                                Subtotal — {g.label} (Selected)
                                                                            </TableCell>
                                                                            <TableCell className="py-3 text-right font-semibold">
                                                                                {formatPHP(g.subtotalSelected)}
                                                                            </TableCell>
                                                                        </TableRow>
                                                                    </React.Fragment>
                                                                ))}

                                                                {/* Grand total row */}
                                                                <TableRow>
                                                                    <TableCell
                                                                        colSpan={6}
                                                                        className="py-4 text-right text-sm font-semibold"
                                                                    >
                                                                        GRAND TOTAL (Selected)
                                                                    </TableCell>
                                                                    <TableCell className="py-4 text-right text-sm font-semibold">
                                                                        {formatPHP(grandTotal)}
                                                                    </TableCell>
                                                                </TableRow>
                                                            </>
                                                        )}
                                                    </TableBody>
                                                </Table>
                                            </div>

                                            {/* keep the lower horizontal scrollbar */}
                                            <ScrollBar orientation="horizontal" />
                                        </ScrollArea>
                                    </div>
                                </div>
                            </Card>

                            {/* Sticky action bar */}
                            <Card className="sticky bottom-4 z-20 min-w-0 overflow-hidden border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                                <div className="p-4 md:p-5">
                                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                        <div className="flex items-center gap-4">
                                            <div>
                                                <div className="text-xs text-muted-foreground">
                                                    CCMs Included
                                                </div>
                                                <div className="text-2xl font-semibold">
                                                    {includedCount}
                                                </div>
                                            </div>

                                            <div className="h-10 w-px bg-border" />

                                            <div>
                                                <div className="text-xs text-muted-foreground">
                                                    Grand Total
                                                </div>
                                                <div className="text-2xl font-semibold">
                                                    {formatPHP(grandTotal)}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-3 md:items-end">
                                            <div className="flex items-center justify-between gap-3 md:justify-end">
                                                <div className="flex items-center gap-2">
                                                    <Checkbox
                                                        checked={allChecked}
                                                        onCheckedChange={(v) => toggleAll(Boolean(v))}
                                                        disabled={dLoading || posting || totalDetails === 0}
                                                    />
                                                    <span className="text-sm text-muted-foreground">
                                                        Select all
                                                    </span>
                                                </div>

                                                <div className="text-xs text-muted-foreground">
                                                    {anyChecked ? "Ready to post" : "Select at least one CCM"}
                                                </div>
                                            </div>

                                            <Button
                                                className="h-12 w-full rounded-xl md:min-w-[320px]"
                                                onClick={onPostClick} // ✅ open confirm first
                                                disabled={!activeId || !anyChecked || posting}
                                            >
                                                {posting ? (
                                                    <>
                                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                        Posting…
                                                    </>
                                                ) : (
                                                    <>
                                                        <CheckCircle2 className="mr-2 h-4 w-4" />
                                                        Post Transmittal
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}