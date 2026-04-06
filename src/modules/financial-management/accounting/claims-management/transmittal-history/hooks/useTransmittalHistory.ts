// src/modules/financial-management/claims-management/transmittal-history/hooks/useTransmittalHistory.ts
"use client";

import * as React from "react";
import type { TransmittalHistoryRow } from "../types";
import { getTransmittalHistoryPaged } from "../providers/fetchProvider";

function isAbortError(e: unknown): boolean {
    if (e instanceof DOMException && e.name === "AbortError") return true;

    if (e instanceof Error && e.name === "AbortError") return true;

    const msg =
        e instanceof Error
            ? e.message
            : typeof e === "string"
                ? e
                : e == null
                    ? ""
                    : String(e);

    const s = msg.toLowerCase();
    return s.includes("aborted") || s.includes("abort");
}

function errorMessage(e: unknown): string {
    if (e instanceof Error) return e.message;
    if (typeof e === "string") return e;
    if (e == null) return "Unknown error";
    return String(e);
}

export function useTransmittalHistory(opts?: { page: number; limit: number; status?: string }) {
    const [rows, setRows] = React.useState<TransmittalHistoryRow[]>([]);
    const [total, setTotal] = React.useState(0);

    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const [search, setSearch] = React.useState("");
    const [openId, setOpenId] = React.useState<number | null>(null);

    const page = Math.max(1, Number(opts?.page ?? 1));
    const limit = Math.min(100, Math.max(10, Number(opts?.limit ?? 20)));

    // expected values: "", "FOR RECEIVING", "FOR PAYMENT", "POSTED", "RECEIVED"
    const status = String(opts?.status ?? "").trim();

    React.useEffect(() => {
        const ac = new AbortController();

        setLoading(true);
        setError(null);

        getTransmittalHistoryPaged(
            {
                q: search.trim(),
                status: status || undefined,
                page,
                limit,
            },
            ac.signal
        )
            .then((r) => {
                if (ac.signal.aborted) return;
                setRows(r.rows);
                setTotal(r.total);
            })
            .catch((e: unknown) => {
                if (ac.signal.aborted || isAbortError(e)) return;
                setError(errorMessage(e));
            })
            .finally(() => {
                if (!ac.signal.aborted) setLoading(false);
            });

        return () => ac.abort();
    }, [search, status, page, limit]);

    return {
        loading,
        rows,
        total,
        error,

        search,
        setSearch,

        openId,
        setOpenId,
    };
}