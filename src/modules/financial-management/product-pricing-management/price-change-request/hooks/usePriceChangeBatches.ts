"use client";

import * as React from "react";
import { toast } from "sonner";

import type { ListQuery, PriceChangeBatchHeader } from "../types";
import * as api from "../providers/pcrApi";

function getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) return error.message;
    return fallback;
}

export function usePriceChangeBatches(
    query: ListQuery,
    setQuery: React.Dispatch<React.SetStateAction<ListQuery>>,
) {
    const [rows, setRows] = React.useState<PriceChangeBatchHeader[]>([]);
    const [total, setTotal] = React.useState(0);
    const [loading, setLoading] = React.useState(false);
    const [acting, setActing] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const refresh = React.useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.listPriceChangeBatches(query);
            setRows(res.data ?? []);
            setTotal(Number(res.meta?.total_count ?? (res.data?.length ?? 0)));
            setError(null);
        } catch (error: unknown) {
            const message = getErrorMessage(error, "Failed to load price change batches");
            setRows([]);
            setTotal(0);
            setError(message);
        } finally {
            setLoading(false);
        }
    }, [query]);

    React.useEffect(() => {
        void refresh();
    }, [refresh]);

    const approve = React.useCallback(async (headerId: number) => {
        setActing(true);
        try {
            const result = await api.approvePriceChangeBatch(headerId);
            toast.success(`${result.affected} price change line(s) approved and applied.`);
            await refresh();
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, "Failed to approve batch"));
        } finally {
            setActing(false);
        }
    }, [refresh]);

    const reject = React.useCallback(async (headerId: number, reason: string) => {
        setActing(true);
        try {
            await api.rejectPriceChangeBatch(headerId, reason);
            toast.success("Batch rejected.");
            await refresh();
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, "Failed to reject batch"));
        } finally {
            setActing(false);
        }
    }, [refresh]);

    return {
        query,
        setQuery,
        rows,
        total,
        loading,
        acting,
        error,
        refresh,
        approve,
        reject,
    };
}
