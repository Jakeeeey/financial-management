// src/modules/financial-management/claims-management/for-receiving/hooks/useAvailableCCMs.ts
"use client";

import * as React from "react";
import type { CCMRow } from "../utils/types";
import { fetchAvailableCCMs } from "../providers/receivingApi";

type Args = {
    open: boolean;
    supplierId: number | null;
    q: string;
    excludeIds: number[];
};

function errorMessage(e: unknown): string {
    if (e instanceof Error) return e.message;
    if (typeof e === "string") return e;
    if (e == null) return "Unknown error";
    return String(e);
}

export function useAvailableCCMs({ open, supplierId, q, excludeIds }: Args) {
    const [rows, setRows] = React.useState<CCMRow[]>([]);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState<string>("");

    // debounce search so it doesn't hammer API per keystroke
    const [dq, setDq] = React.useState(q);
    React.useEffect(() => {
        const t = window.setTimeout(() => setDq(q), 250);
        return () => window.clearTimeout(t);
    }, [q]);

    const reload = React.useCallback(() => {
        if (!open || !supplierId) return () => {};

        const ac = new AbortController();

        (async () => {
            try {
                // Only show "hard" loading if we have no data
                if (rows.length === 0) {
                    setLoading(true);
                }
                setError("");

                const data = await fetchAvailableCCMs({
                    supplierId,
                    q: dq,
                    excludeIds,
                });

                if (!ac.signal.aborted) setRows(data);
            } catch (e: unknown) {
                if (!ac.signal.aborted) {
                    setError(errorMessage(e));
                    setRows([]);
                }
            } finally {
                if (!ac.signal.aborted) setLoading(false);
            }
        })();

        return () => ac.abort();
    }, [open, supplierId, dq, excludeIds, rows.length]);

    React.useEffect(() => reload(), [reload]);

    return { rows, loading, error, reload: () => reload() };
}