// src/modules/financial-management/claims-management/for-receiving/components/AddCCMDialog.tsx
"use client";

import * as React from "react";
import { Check, Loader2, Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from "@/components/ui/sheet";

import { formatPHP, toNumberSafe } from "../utils/format";
import type { CCMRow } from "../utils/types";
import { useAvailableCCMs } from "../hooks/useAvailableCCMs";
import { addCCMsToTransmittal } from "../providers/receivingApi";

type Props = {
    open: boolean;
    onOpenChange: (v: boolean) => void;

    transmittalId: number | null;
    supplierId: number | null;

    existingMemoIds: number[];

    onAdded?: () => void;
};

function getErrorMessage(e: unknown): string {
    if (e instanceof Error) return e.message;
    if (typeof e === "string") return e;

    if (typeof e === "object" && e !== null) {
        const maybeMsg = (e as { message?: unknown }).message;
        if (typeof maybeMsg === "string") return maybeMsg;
    }

    return "Something went wrong.";
}

export default function AddCCMDialog({
                                         open,
                                         onOpenChange,
                                         transmittalId,
                                         supplierId,
                                         existingMemoIds,
                                         onAdded,
                                     }: Props) {
    const [q, setQ] = React.useState("");
    const [selected, setSelected] = React.useState<Record<number, boolean>>({});
    const [saving, setSaving] = React.useState(false);

    const canUse = !!transmittalId && !!supplierId;

    React.useEffect(() => {
        if (!open) {
            setQ("");
            setSelected({});
            setSaving(false);
        }
    }, [open]);

    const { rows, loading, error, reload } = useAvailableCCMs({
        open,
        supplierId,
        q,
        excludeIds: existingMemoIds,
    });

    const selectedIds = React.useMemo(
        () => Object.entries(selected).filter(([, v]) => v).map(([k]) => Number(k)),
        [selected]
    );

    const selectedTotal = React.useMemo(() => {
        const byId = new Map<number, CCMRow>();
        rows.forEach((r) => byId.set(r.id, r));
        return selectedIds.reduce((sum, id) => sum + toNumberSafe(byId.get(id)?.amount), 0);
    }, [rows, selectedIds]);

    function toggle(id: number) {
        if (!canUse || saving) return;
        setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
    }

    async function onAddSelected() {
        if (!canUse) return;
        if (!transmittalId) return;
        if (selectedIds.length === 0) return;

        try {
            setSaving(true);
            await addCCMsToTransmittal(transmittalId, selectedIds);
            toast.success("CCM(s) added to transmittal.");
            onOpenChange(false);
            onAdded?.();
        } catch (e: unknown) {
            toast.error(getErrorMessage(e));
        } finally {
            setSaving(false);
        }
    }

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="right"
                className={[
                    "w-[min(560px,100vw)] sm:w-[560px]",
                    "h-dvh p-0 overflow-hidden",
                    "flex flex-col",
                ].join(" ")}
            >
                {/* Header */}
                <SheetHeader className="shrink-0 p-6 pb-4">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <SheetTitle className="text-lg">Add Customer Credit Memos</SheetTitle>
                            <SheetDescription className="mt-1 text-sm">
                                {canUse ? "Select CCMs to include in this transmittal." : "Select a transmittal first."}
                            </SheetDescription>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                            <Badge variant="secondary" className="rounded-full">
                                Selected: {selectedIds.length}
                            </Badge>
                            <Badge variant="secondary" className="rounded-full">
                                Total: {formatPHP(selectedTotal)}
                            </Badge>
                        </div>
                    </div>
                </SheetHeader>

                {/* Search */}
                <div className="shrink-0 px-6 pb-4">
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder="Search memo # or reason…"
                            className="pl-9"
                            disabled={!canUse}
                        />
                    </div>

                    {error ? (
                        <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
                            <div className="font-medium text-destructive">Failed to load CCMs</div>
                            <div className="mt-1 text-muted-foreground">{error}</div>
                            <div className="mt-3">
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        reload();
                                    }}
                                >
                                    Retry
                                </Button>
                            </div>
                        </div>
                    ) : null}
                </div>

                <Separator />

                {/* ✅ SCROLLABLE LIST REGION */}
                <div className="flex-1 min-h-0 px-6 py-4">
                    <div
                        className={[
                            "h-full overflow-y-auto overscroll-contain",
                            "pr-2",
                        ].join(" ")}
                    >
                        {!canUse ? (
                            <div className="rounded-xl border p-6 text-center text-sm text-muted-foreground">
                                Pick a transmittal to load available CCMs.
                            </div>
                        ) : loading ? (
                            <div className="rounded-xl border p-6 text-center text-sm text-muted-foreground">
                                <span className="inline-flex items-center gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Loading…
                                </span>
                            </div>
                        ) : rows.length === 0 ? (
                            <div className="rounded-xl border p-6 text-center text-sm text-muted-foreground">
                                No available CCMs found.
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {rows.map((r) => {
                                    const isOn = !!selected[r.id];

                                    return (
                                        <button
                                            key={r.id}
                                            type="button"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                toggle(r.id);
                                            }}
                                            className={[
                                                "w-full min-w-0 rounded-xl border p-4 text-left transition",
                                                "cursor-pointer",
                                                isOn ? "border-foreground/30 bg-muted" : "hover:bg-muted/50",
                                            ].join(" ")}
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border">
                                                            {isOn ? <Check className="h-4 w-4" /> : null}
                                                        </span>

                                                        <div className="min-w-0 font-mono text-sm font-semibold">
                                                            {r.memo_number ?? `CCM #${r.id}`}
                                                        </div>
                                                    </div>

                                                    <div className="mt-1 truncate text-sm text-muted-foreground">
                                                        {r.customer_name
                                                            ? r.customer_name
                                                            : r.customer_id
                                                                ? `Customer #${r.customer_id}`
                                                                : "—"}
                                                    </div>

                                                    <div className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                                                        {r.reason ?? "—"}
                                                    </div>
                                                </div>

                                                <div className="shrink-0 text-right">
                                                    <div className="text-xs text-muted-foreground">Amount</div>
                                                    <div className="font-mono text-sm font-semibold">
                                                        {formatPHP(toNumberSafe(r.amount))}
                                                    </div>
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                <Separator />

                {/* Footer */}
                <div className="shrink-0 p-6 pt-4">
                    <div className="flex items-center justify-end gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onOpenChange(false);
                            }}
                            disabled={saving}
                        >
                            Cancel
                        </Button>

                        <Button
                            type="button"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onAddSelected();
                            }}
                            disabled={!canUse || saving || selectedIds.length === 0}
                            className="rounded-full px-6"
                        >
                            {saving ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Adding…
                                </>
                            ) : (
                                <>Add Selected</>
                            )}
                        </Button>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}