"use client";

import * as React from "react";
import { toast } from "sonner";
import type { ListQuery, PriceChangeRequestRow } from "../types";
import * as api from "../providers/pcrApi";

function getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) return error.message;
    return fallback;
}

export function usePCRList(initial?: Partial<ListQuery>) {
    const [query, setQuery] = React.useState<ListQuery>({
        status: "PENDING",
        page: 1,
        page_size: 50,
        ...initial,
    });

    const [rows, setRows] = React.useState<PriceChangeRequestRow[]>([]);
    const [total, setTotal] = React.useState<number>(0);
    const [loading, setLoading] = React.useState(false);

    const refresh = React.useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.listRequests(query);
            setRows(res.data ?? []);
            setTotal(Number(res.meta?.total_count ?? (res.data?.length ?? 0)));
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, "Failed to load requests"));
        } finally {
            setLoading(false);
        }
    }, [query]);

    React.useEffect(() => {
        void refresh();
    }, [refresh]);

    return {
        query,
        setQuery,
        rows,
        total,
        loading,
        refresh,
    };
}