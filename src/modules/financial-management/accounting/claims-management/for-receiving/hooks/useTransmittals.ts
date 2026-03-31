//src/modules/financial-management/claims-management/for-receiving/hooks/useTransmittals.ts
"use client";

import * as React from "react";
import type { TransmittalRow } from "../utils/types";
import { fetchForReceivingTransmittals } from "../providers/receivingApi";

function errorMessage(e: unknown): string {
    if (e instanceof Error) return e.message;
    if (typeof e === "string") return e;
    if (e == null) return "Unknown error";
    return String(e);
}

function isAbortError(e: unknown): boolean {
    // Native fetch abort
    if (e instanceof DOMException && e.name === "AbortError") return true;
    if (e instanceof Error && e.name === "AbortError") return true;

    // Some wrappers throw generic Error with abort wording
    const msg = errorMessage(e).toLowerCase();
    return msg.includes("aborted") || msg.includes("abort") || msg.includes("signal is aborted");
}

export function useTransmittals(filters: { q: string; supplierId: number | null }) {
    const [rows, setRows] = React.useState<TransmittalRow[]>([]);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [tick, setTick] = React.useState(0);

    const reload = React.useCallback(() => setTick((x) => x + 1), []);

    React.useEffect(() => {
        const ac = new AbortController();

        // Only show "hard" loading if we have no data
        const isInitial = rows.length === 0;
        if (isInitial) {
            setLoading(true);
        }
        setError(null);

        fetchForReceivingTransmittals(
            { q: filters.q.trim(), supplier_id: filters.supplierId },
            ac.signal
        )
            .then((data) => {
                if (ac.signal.aborted) return;
                setRows(data);
            })
            .catch((e: unknown) => {
                // ✅ Ignore aborts (normal during navigation/rerender)
                if (ac.signal.aborted || isAbortError(e)) return;
                setError(errorMessage(e));
            })
            .finally(() => {
                if (!ac.signal.aborted) setLoading(false);
            });

        return () => ac.abort();
    }, [filters.q, filters.supplierId, tick, rows.length]);

    return { rows, loading, error, reload };
}