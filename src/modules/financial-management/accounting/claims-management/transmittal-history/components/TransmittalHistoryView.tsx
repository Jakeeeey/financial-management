//src/modules/financial-management/claims-management/transmittal-history/components/TransmittalHistoryView.tsx
"use client";

import * as React from "react";
import { ChevronDown, Search, ChevronLeft, ChevronRight } from "lucide-react";

import { useTransmittalHistory } from "../hooks/useTransmittalHistory";
import type { TransmittalHistoryRow } from "../types";

import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

import { formatMoneyPHP, formatDateMDY } from "../utils/format";
import { prettyStatus, statusTone } from "../utils/status";
import { printTransmittalHistory } from "../utils/printTransmittalHistory";
import { fetchTransmittalDetails, fetchCompanyProfile } from "../../for-receiving/providers/receivingApi";
import { toast } from "sonner";
import { Printer, Loader2 } from "lucide-react";

/** DB-stored status values (per your types.ts) */
type StatusFilter = "ALL" | "FOR RECEIVING" | "FOR PAYMENT" | "RECEIVED" | "POSTED";

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
    { value: "ALL", label: "All" },
    { value: "FOR RECEIVING", label: "For Receiving" },
    { value: "FOR PAYMENT", label: "For Payment" },
    { value: "RECEIVED", label: "Received" },
    { value: "POSTED", label: "Posted" },
];

function StatusBadge({ status }: { status: string }) {
    const s = String(status ?? "").trim();
    const label = s ? prettyStatus(s) : "—";
    const tone = statusTone(s);

    const cls =
        !s || s === "—"
            ? "!bg-muted !text-muted-foreground !border !border-border"
            : tone === "forReceiving"
                ? "!bg-blue-600 !text-white !border-transparent"
                : tone === "forPayment"
                    ? "!bg-amber-500 !text-white !border-transparent"
                    : tone === "received"
                        ? "!bg-emerald-600 !text-white !border-transparent"
                        : tone === "posted"
                            ? "!bg-muted !text-foreground !border !border-border"
                            : "!bg-secondary !text-secondary-foreground !border !border-border";

    return (
        <Badge
            variant="secondary"
            className={cn("rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap", cls)}
        >
            {label}
        </Badge>
    );
}

function ExpandedDetails({ row, onPrint }: { row: TransmittalHistoryRow; onPrint: (row: TransmittalHistoryRow) => void }) {
    return (
        <div className="px-6 py-5">
            <div className="text-sm font-semibold">Included CCMs ({row.details.length})</div>

            <div className="mt-3 space-y-3">
                {row.details.map((d) => (
                    <div key={d.id} className="rounded-lg border bg-card px-4 py-3 shadow-sm">
                        <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                                <div className="text-sm font-semibold">{d.memo_number}</div>
                                <div className="mt-0.5 text-xs text-muted-foreground">
                                    {d.reason ? d.reason : "—"}
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <div className="text-sm font-semibold tabular-nums">
                                    {formatMoneyPHP(d.amount)}
                                </div>

                                <Badge variant="secondary" className="rounded-full text-[11px]">
                                    in-transmittal
                                </Badge>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <Separator className="my-5" />

            <div className="flex items-end justify-end gap-6">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPrint(row)}
                    className="gap-2"
                >
                    <Printer className="h-4 w-4" />
                    Print Transmittal
                </Button>
                <div className="text-right">
                    <div className="text-xs text-muted-foreground">Grand Total</div>
                    <div className="text-2xl font-bold tabular-nums">
                        {formatMoneyPHP(row.total_amount)}
                    </div>
                </div>
            </div>
        </div>
    );
}

function clamp(n: number, min: number, max: number) {
    return Math.max(min, Math.min(max, n));
}

export default function TransmittalHistoryView() {
    // ✅ Pagination state (backend-driven)
    const [page, setPage] = React.useState(1);
    const pageSize = 20;

    // ✅ NEW: status filter (server-side)
    const [status, setStatus] = React.useState<StatusFilter>("ALL");

    const {
        loading,
        rows, // ✅ now already a single page from backend
        total, // ✅ backend total
        error,
        search,
        setSearch,
        openId,
        setOpenId,
    } = useTransmittalHistory({
        page,
        limit: pageSize,
        status: status === "ALL" ? "" : status,
    });

    const [printingId, setPrintingId] = React.useState<number | null>(null);

    const handlePrint = async (row: TransmittalHistoryRow) => {
        if (printingId) return;
        try {
            setPrintingId(row.id);
            const [details, company] = await Promise.all([
                fetchTransmittalDetails(row.id),
                fetchCompanyProfile(),
            ]);

            printTransmittalHistory({
                header: {
                    transmittal_no: row.transmittal_no,
                    status: row.status,
                    supplier_name: row.supplier_name,
                    representative_name: row.representative_name,
                    created_at: row.created_at,
                    total_amount: row.total_amount,
                },
                lines: details,
                company,
            });
        } catch (err) {
            console.error("Print failed", err);
            toast.error("Failed to prepare printable document.");
        } finally {
            setPrintingId(null);
        }
    };

    // Expose handlePrint to ExpandedDetails via a hacky way since it's outside or pass it down
    // For simplicity in this existing structure, I'll use a ref or just move handlePrint up
    // Actually, I'll just pass it to ExpandedDetails if I were refactoring, 
    // but I'll just use a small trick or move it.

    const pageCount = Math.max(1, Math.ceil((total || 0) / pageSize));

    // clamp page if total changes (ex: new search results / filter results)
    React.useEffect(() => {
        setPage((p) => clamp(p, 1, pageCount));
    }, [pageCount]);

    // close expanded row if it’s not in current page
    React.useEffect(() => {
        if (!openId) return;
        const stillVisible = rows.some((r) => r.id === openId);
        if (!stillVisible) setOpenId(null);
    }, [rows, openId, setOpenId]);

    const canPrev = page > 1;
    const canNext = page < pageCount;

    const activeStatusLabel = STATUS_FILTERS.find((x) => x.value === status)?.label ?? "All";

    return (
        <div className="space-y-4">
            <div>
                <div className="text-3xl font-bold tracking-tight">Transmittal History</div>
                <div className="mt-1 text-sm text-muted-foreground">
                    View posted and received transmittals
                </div>
            </div>

            {/* Search + Status Filters */}
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="relative md:w-[520px]">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value);
                            setPage(1);
                            setOpenId(null);
                        }}
                        placeholder="Search by Rec No, supplier, or representative..."
                        className="pl-9"
                    />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <div className="text-xs text-muted-foreground mr-1">Status:</div>

                    {STATUS_FILTERS.map((opt) => {
                        const active = status === opt.value;
                        return (
                            <Button
                                key={opt.value}
                                type="button"
                                size="sm"
                                variant={active ? "default" : "outline"}
                                className="h-8 rounded-full"
                                disabled={loading && active}
                                onClick={() => {
                                    setStatus(opt.value);
                                    setPage(1);
                                    setOpenId(null);
                                }}
                            >
                                {opt.label}
                            </Button>
                        );
                    })}
                </div>
            </div>

            <Card className="p-4">
                <div className="px-2 pb-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="text-sm font-semibold">
                            {status === "ALL"
                                ? `All Transmittals (${loading ? "…" : total})`
                                : `${activeStatusLabel} Transmittals (${loading ? "…" : total})`}
                        </div>

                        <Badge variant="secondary" className="font-mono">
                            {loading ? "Loading…" : `${total} total`}
                        </Badge>

                        <Badge variant="outline" className="font-mono">
                            {`Page ${page}/${pageCount}`}
                        </Badge>

                        {status !== "ALL" ? (
                            <Badge variant="outline" className="rounded-full">
                                {activeStatusLabel}
                            </Badge>
                        ) : null}
                    </div>

                    <div className="mt-1 text-xs text-muted-foreground">
                        Historical record of received and posted transmittals
                    </div>
                </div>

                <div className="rounded-lg border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-10" />
                                <TableHead>Rec No</TableHead>
                                <TableHead>Supplier</TableHead>
                                <TableHead>Representative</TableHead>
                                <TableHead className="whitespace-nowrap">Created Date</TableHead>
                                <TableHead className="whitespace-nowrap text-right">CCM Count</TableHead>
                                <TableHead className="whitespace-nowrap text-right">Total Amount</TableHead>
                                <TableHead className="whitespace-nowrap">Status</TableHead>
                            </TableRow>
                        </TableHeader>

                        <TableBody>
                            {loading ? (
                                Array.from({ length: 6 }).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell className="py-4">
                                            <Skeleton className="h-4 w-4 rounded" />
                                        </TableCell>
                                        <TableCell className="py-4" colSpan={7}>
                                            <Skeleton className="h-4 w-full" />
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : error ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="py-10 text-center">
                                        <div className="text-sm font-medium">Failed to load history</div>
                                        <div className="mt-1 text-xs text-muted-foreground">{error}</div>
                                    </TableCell>
                                </TableRow>
                            ) : rows.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="py-10 text-center">
                                        <div className="text-sm font-medium">No transmittals</div>
                                        <div className="mt-1 text-xs text-muted-foreground">
                                            Try adjusting your search or status filter.
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                rows.map((row) => {
                                    const isOpen = openId === row.id;

                                    return (
                                        <React.Fragment key={row.id}>
                                            <TableRow className={cn(isOpen && "bg-muted/40")}>
                                                <TableCell className="w-10">
                                                    <button
                                                        type="button"
                                                        onClick={() => setOpenId(isOpen ? null : row.id)}
                                                        className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted"
                                                        aria-label={isOpen ? "Collapse" : "Expand"}
                                                    >
                                                        <ChevronDown
                                                            className={cn(
                                                                "h-4 w-4 transition-transform",
                                                                isOpen && "rotate-180"
                                                            )}
                                                        />
                                                    </button>
                                                </TableCell>

                                                <TableCell className="font-semibold">{row.transmittal_no}</TableCell>
                                                <TableCell className="min-w-[240px]">{row.supplier_name}</TableCell>
                                                <TableCell className="min-w-[180px]">{row.representative_name}</TableCell>
                                                <TableCell className="whitespace-nowrap">
                                                    {formatDateMDY(row.created_at)}
                                                </TableCell>
                                                <TableCell className="text-right tabular-nums">{row.ccm_count}</TableCell>
                                                <TableCell className="text-right tabular-nums">
                                                    {formatMoneyPHP(row.total_amount)}
                                                </TableCell>

                                                <TableCell className="whitespace-nowrap align-middle">
                                                    <div className="flex items-center gap-3">
                                                        <StatusBadge status={row.status} />
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handlePrint(row);
                                                            }}
                                                            disabled={printingId === row.id}
                                                            title="Print Transmittal"
                                                        >
                                                            {printingId === row.id ? (
                                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                            ) : (
                                                                <Printer className="h-4 w-4" />
                                                            )}
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>

                                            {isOpen ? (
                                                <TableRow>
                                                    <TableCell colSpan={8} className="p-0">
                                                        <ExpandedDetails row={row} onPrint={handlePrint} />
                                                    </TableCell>
                                                </TableRow>
                                            ) : null}
                                        </React.Fragment>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>

                <div className="mt-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between px-2">
                    <div className="text-sm text-muted-foreground">
                        Showing{" "}
                        <span className="font-medium text-foreground">
                            {loading ? "…" : rows.length}
                        </span>{" "}
                        row(s) on this page •{" "}
                        <span className="font-medium text-foreground">
                            {loading ? "…" : total}
                        </span>{" "}
                        total
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            disabled={!canPrev || loading}
                            onClick={() => {
                                setPage((p) => Math.max(1, p - 1));
                                setOpenId(null);
                            }}
                        >
                            <ChevronLeft className="mr-1 h-4 w-4" />
                            Prev
                        </Button>

                        <div className="min-w-[140px] rounded-md border px-3 py-2 text-center text-sm">
                            Page <span className="font-medium">{page}</span> of{" "}
                            <span className="font-medium">{pageCount}</span>
                        </div>

                        <Button
                            type="button"
                            variant="outline"
                            disabled={!canNext || loading}
                            onClick={() => {
                                setPage((p) => Math.min(pageCount, p + 1));
                                setOpenId(null);
                            }}
                        >
                            Next
                            <ChevronRight className="ml-1 h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
    );
}