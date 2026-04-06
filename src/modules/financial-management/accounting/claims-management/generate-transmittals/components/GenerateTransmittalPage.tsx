//src/modules/financial-management-system/claims-management/generate-transmittals/components/GenerateTransmittalPage.tsx
"use client";

import * as React from "react";
import { toast } from "sonner";
import { Loader2, ReceiptText, RefreshCw } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

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

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

import { AsyncCombobox } from "./AsyncCombobox";
import { AvailableCCMList } from "./AvailableCCMList";

import { useAvailableCCMs } from "../hooks/useAvailableCCMs";
import {
    createTransmittal,
    searchSupplierRepresentatives,
    searchSuppliers,
} from "../providers/transmittalApi";

import { formatPHP, toNumberSafe } from "../utils/format";

type Pick = { id: number; label: string };

const SUPPLIER_MIN_CHARS = 2;

function errorMessage(e: unknown): string {
    if (e instanceof Error) return e.message;
    if (typeof e === "string") return e;
    if (e == null) return "Unknown error";
    return String(e);
}

function isAbortError(e: unknown): boolean {
    if (e instanceof DOMException && e.name === "AbortError") return true;
    if (e instanceof Error && e.name === "AbortError") return true;

    const msg = errorMessage(e).toLowerCase();
    return msg.includes("aborted") || msg.includes("abort");
}

// small helpers for review list (no `any`)
function safeText(v: unknown): string {
    return typeof v === "string" ? v : v == null ? "" : String(v);
}

function safeMemoNo(row: unknown): string {
    if (row && typeof row === "object") {
        const rec = row as Record<string, unknown>;
        const memo = safeText(rec["memo_number"]).trim();
        const id = safeText(rec["id"]).trim();
        if (memo && memo !== "null" && memo !== "undefined") return memo;
        if (id) return `CCM #${id}`;
    }
    return "—";
}

function safeCustomerName(row: unknown): string {
    if (row && typeof row === "object") {
        const rec = row as Record<string, unknown>;
        const s = safeText(rec["customer_name"]).trim();
        return s || "—";
    }
    return "—";
}

function safeAmount(row: unknown): number {
    if (row && typeof row === "object") {
        const rec = row as Record<string, unknown>;
        return toNumberSafe(rec["amount"]);
    }
    return 0;
}

export default function GenerateTransmittalPage() {
    // Step 1
    const [supplier, setSupplier] = React.useState<Pick | null>(null);

    // Step 2
    const [rep, setRep] = React.useState<Pick | null>(null);

    // Step 2 cache: preload reps so clicking shows immediately (no typing needed)
    const [repCache, setRepCache] = React.useState<Pick[]>([]);
    const [repCacheLoading, setRepCacheLoading] = React.useState(false);

    // Step 3 (inline list)
    const [selectedIds, setSelectedIds] = React.useState<number[]>([]);
    const [submitting, setSubmitting] = React.useState(false);

    // ✅ Review modal state
    const [reviewOpen, setReviewOpen] = React.useState(false);

    const step1Done = !!supplier?.id;
    const step2Done = step1Done && !!rep?.id;

    // ✅ Enable fetching only when supplier+rep are both selected
    const { rows, loading, error, reload } = useAvailableCCMs({
        supplierId: supplier?.id ?? null,
        enabled: step2Done,
    });

    // Reset downstream when supplier changes
    React.useEffect(() => {
        setRep(null);
        setSelectedIds([]);
        setRepCache([]);
    }, [supplier?.id]);

    // Preload all supplier representatives ON supplier selection
    React.useEffect(() => {
        let mounted = true;
        const controller = new AbortController();

        async function preloadReps() {
            if (!supplier?.id) return;

            try {
                setRepCacheLoading(true);
                // q = "" => "show all"
                const reps = await searchSupplierRepresentatives(
                    supplier.id,
                    "",
                    controller.signal
                );
                if (!mounted) return;
                setRepCache(Array.isArray(reps) ? reps : []);
            } catch (e: unknown) {
                // ignore abort
                if (isAbortError(e)) return;
                if (!mounted) return;
                setRepCache([]);
                toast.error(errorMessage(e));
            } finally {
                if (mounted) setRepCacheLoading(false);
            }
        }

        preloadReps();

        return () => {
            mounted = false;
            controller.abort();
        };
    }, [supplier?.id]);

    // Reset memo selection when rep changes (recommended)
    React.useEffect(() => {
        setSelectedIds([]);
    }, [rep?.id]);

    const selectedTotal = React.useMemo(() => {
        const map = new Map(rows.map((r) => [r.id, toNumberSafe(r.amount)]));
        return selectedIds.reduce((sum, id) => sum + (map.get(id) ?? 0), 0);
    }, [rows, selectedIds]);

    const canGenerate = step2Done && selectedIds.length > 0 && !submitting;

    function toggle(id: number, checked: boolean) {
        setSelectedIds((prev) => {
            if (checked) return prev.includes(id) ? prev : [...prev, id];
            return prev.filter((x) => x !== id);
        });
    }

    function toggleAll(checked: boolean, ids?: number[]) {
        if (!checked) return setSelectedIds([]);

        const sourceIds =
            Array.isArray(ids) && ids.length > 0 ? ids : rows.map((r) => r.id);

        setSelectedIds((prev) => {
            const set = new Set(prev);
            sourceIds.forEach((id) => set.add(id));
            return Array.from(set);
        });
    }

    // ✅ Selected CCM rows for review (stable order)
    const selectedRowsForReview = React.useMemo(() => {
        const map = new Map<number, unknown>();
        for (const r of rows) map.set(r.id, r);

        const picked: unknown[] = [];
        for (const id of selectedIds) {
            const row = map.get(id);
            if (row) picked.push(row);
        }

        // Sort by memo_number (fallback to id string)
        picked.sort((a, b) => safeMemoNo(a).localeCompare(safeMemoNo(b), undefined, { sensitivity: "base" }));
        return picked;
    }, [rows, selectedIds]);

    // ✅ Real generate logic (unchanged, just moved)
    async function doGenerate() {
        if (!supplier?.id || !rep?.id || selectedIds.length === 0) return;

        try {
            setSubmitting(true);

            const res = await createTransmittal({
                supplier_id: supplier.id,
                supplier_representative_id: rep.id,
                customer_memo_ids: selectedIds,
            });

            toast.success(`Transmittal created: ${res.transmittal_no}`);

            // ✅ reset page to blank
            setSelectedIds([]);
            setRep(null);
            setSupplier(null);
        } catch (e: unknown) {
            toast.error(errorMessage(e));
        } finally {
            setSubmitting(false);
        }
    }

    // ✅ Open review first
    function onGenerateClick() {
        if (!canGenerate) return;
        setReviewOpen(true);
    }

    // ✅ Supplier: enforce 2 chars before hitting API
    const fetchSuppliersMin2 = React.useCallback(
        async (q: string, signal?: AbortSignal) => {
            const term = String(q ?? "").trim();
            if (term.length < SUPPLIER_MIN_CHARS) return [];
            return searchSuppliers(term, signal);
        },
        []
    );

    // ✅ Rep: no typing required.
    // - if q is empty => return preloaded reps (all)
    // - if q has text => filter preloaded reps (fast) OR fallback to API if you prefer
    const fetchRepsShowAllOnEmpty = React.useCallback(
        async (q: string, signal?: AbortSignal) => {
            if (!supplier?.id) return [];
            const term = String(q ?? "").trim();

            // empty query => show all cached reps
            if (term.length === 0) return repCache;

            // filter cache locally
            const lower = term.toLowerCase();
            const filtered = repCache.filter((r) =>
                String(r.label ?? "").toLowerCase().includes(lower)
            );

            // if cache has results, use it
            if (filtered.length > 0) return filtered;

            // fallback (optional): hit API if not found in cache
            return searchSupplierRepresentatives(supplier.id, term, signal);
        },
        [supplier?.id, repCache]
    );

    return (
        <div className="space-y-4 p-4 pb-24 md:p-6 md:pb-24">
            {/* ✅ Review modal */}
            <AlertDialog open={reviewOpen} onOpenChange={setReviewOpen}>
                <AlertDialogContent className="max-w-3xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Review transmittal before generating</AlertDialogTitle>
                        <AlertDialogDescription>
                            Please confirm the supplier, representative, and selected CCMs.
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <div className="mt-3 space-y-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="rounded-lg border p-3">
                                <div className="text-xs text-muted-foreground">Supplier</div>
                                <div className="mt-1 font-medium">{supplier?.label ?? "—"}</div>
                            </div>
                            <div className="rounded-lg border p-3">
                                <div className="text-xs text-muted-foreground">Representative</div>
                                <div className="mt-1 font-medium">{rep?.label ?? "—"}</div>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className="font-mono">
                                Selected: {selectedIds.length}
                            </Badge>

                        </div>

                        <div className="rounded-xl border">
                            <div className="max-h-[340px] overflow-auto">
                                <Table>
                                    <TableHeader className="sticky top-0 z-10 bg-background">
                                        <TableRow>
                                            <TableHead className="w-[220px] whitespace-nowrap">CCM No.</TableHead>
                                            <TableHead className="w-[360px] whitespace-nowrap">Customer</TableHead>
                                            <TableHead className="w-[160px] whitespace-nowrap text-right">Amount</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {selectedRowsForReview.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={3} className="py-8 text-center text-sm text-muted-foreground">
                                                    No CCMs selected.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            selectedRowsForReview.map((r) => {
                                                const memo = safeMemoNo(r);
                                                const customer = safeCustomerName(r);
                                                const amt = safeAmount(r);
                                                const key = `${memo}-${customer}-${String(amt)}`;

                                                return (
                                                    <TableRow key={key}>
                                                        <TableCell className="font-mono text-xs">{memo}</TableCell>
                                                        <TableCell className="text-sm text-muted-foreground">{customer}</TableCell>
                                                        <TableCell className="text-right font-mono text-xs">
                                                            {formatPHP(amt)}
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })
                                        )}

                                        {selectedRowsForReview.length > 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={2} className="py-3 text-right text-sm font-semibold">
                                                    GRAND TOTAL
                                                </TableCell>
                                                <TableCell className="py-3 text-right text-sm font-semibold">
                                                    {formatPHP(selectedTotal)}
                                                </TableCell>
                                            </TableRow>
                                        ) : null}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </div>

                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="cursor-pointer"
                            disabled={!canGenerate}
                            onClick={async () => {
                                setReviewOpen(false);
                                await doGenerate();
                            }}
                        >
                            {submitting ? (
                                <span className="inline-flex items-center gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Generating…
                                </span>
                            ) : (
                                "Yes, generate transmittal"
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Header with Total */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-0.5">
                    <h1 className="text-lg font-semibold tracking-tight">
                        Generate Transmittal
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Select supplier → representative → choose CCMs.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="font-mono">
                        Total: {formatPHP(selectedTotal)}
                    </Badge>
                    <Badge variant="outline" className="font-mono">
                        Selected: {selectedIds.length}
                    </Badge>
                </div>
            </div>

            {/* Supplier selection */}
            <Card className="p-4">
                <div className="space-y-1">
                    <div className="text-sm font-medium">Supplier Selection</div>
                    <div className="text-sm text-muted-foreground">
                        Choose a supplier and their representative
                    </div>
                </div>

                <Separator className="my-4" />

                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label className="text-sm">Supplier</Label>
                        <AsyncCombobox
                            value={supplier}
                            onChange={setSupplier}
                            placeholder="Select supplier…"
                            searchPlaceholder={`Type at least ${SUPPLIER_MIN_CHARS} characters…`}
                            fetchItems={fetchSuppliersMin2}
                        />
                        <div className="text-xs text-muted-foreground">
                            Start typing (min {SUPPLIER_MIN_CHARS} chars) to search suppliers.
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-sm">Supplier Representative</Label>
                        <AsyncCombobox
                            value={rep}
                            onChange={setRep}
                            disabled={!step1Done}
                            placeholder={step1Done ? "Select representative…" : "Select supplier first"}
                            searchPlaceholder="Search name/email/contact…"
                            emptyHint={step1Done ? "No representatives found." : "Select supplier first"}
                            fetchItems={fetchRepsShowAllOnEmpty}
                        />

                        <div className="text-xs text-muted-foreground">
                            {step1Done
                                ? repCacheLoading
                                    ? "Loading representatives…"
                                    : "Click to show all representatives (no typing required)."
                                : "Select a supplier first."}
                        </div>
                    </div>

                    <div className="text-sm text-muted-foreground pt-1">
                        {step2Done
                            ? "Available CCMs will load below. Select items then generate using the button at the bottom."
                            : "Select supplier and representative to load available CCMs."}
                    </div>
                </div>
            </Card>

            {/* Inline CCM list */}
            <Card className="p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-0.5">
                        <div className="text-sm font-medium">
                            Available CCMs{" "}
                            <span className="text-muted-foreground">({step2Done ? rows.length : 0})</span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                            Select CCMs to include in the transmittal
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={reload}
                            disabled={!step2Done || loading}
                        >
                            <RefreshCw
                                className={loading ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"}
                            />
                            Refresh
                        </Button>
                    </div>
                </div>

                {error ? (
                    <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 p-3">
                        <div className="text-sm font-medium text-destructive">
                            Failed to load CCMs
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">{error}</div>
                    </div>
                ) : null}

                <div className="mt-4">
                    <AvailableCCMList
                        rows={step2Done ? rows : []}
                        loading={step2Done ? loading : false}
                        selectedIds={selectedIds}
                        onToggle={(id, checked) => toggle(id, checked)}
                        onToggleAll={toggleAll}
                    />
                </div>
            </Card>

            {/* Bottom action bar */}
            <div className="mt-4 flex items-center justify-between border-t pt-4">
                <div className="flex items-center gap-2" />
                <Button type="button" disabled={!canGenerate} onClick={onGenerateClick}>
                    {submitting ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Generating…
                        </>
                    ) : (
                        <>
                            <ReceiptText className="mr-2 h-4 w-4" />
                            Generate Transmittal
                        </>
                    )}
                </Button>
            </div>
        </div>
    );
}