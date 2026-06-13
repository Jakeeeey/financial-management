"use client";

import * as React from "react";
import { toast } from "sonner";

import type { ItemUnifiedApprovalRow, ListQuery } from "../types";
import * as api from "../providers/pcrApi";
import { applyActionError, applyLoadError } from "../../shared/loadErrorState";

export function useUnifiedApprovals(
    query: ListQuery,
    setQuery: React.Dispatch<React.SetStateAction<ListQuery>>,
) {
    const [rows, setRows] = React.useState<ItemUnifiedApprovalRow[]>([]);
    const [total, setTotal] = React.useState(0);
    const [loading, setLoading] = React.useState(true);
    const [acting, setActing] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [unauthorized, setUnauthorized] = React.useState(false);
    const requestIdRef = React.useRef(0);

    const refresh = React.useCallback(async () => {
        const requestId = ++requestIdRef.current;
        setLoading(true);
        try {
            const res = await api.listUnifiedApprovals(query);

            if (requestId !== requestIdRef.current) return;

            setRows(res.data ?? []);
            setTotal(Number(res.meta?.total_count ?? (res.data?.length ?? 0)));
            setError(null);
            setUnauthorized(false);
        } catch (error: unknown) {
            if (requestId !== requestIdRef.current) return;

            setRows([]);
            setTotal(0);
            applyLoadError(error, "Failed to load approvals", setUnauthorized, setError);
        } finally {
            if (requestId === requestIdRef.current) {
                setLoading(false);
            }
        }
    }, [query]);

    React.useEffect(() => {
        void refresh();
    }, [refresh]);

    const approveBatch = React.useCallback(async (headerId: number) => {
        setActing(true);
        try {
            const result = await api.approvePriceChangeBatch(headerId);
            toast.success(`${result.affected} price change line(s) approved and applied.`);
            await refresh();
        } catch (error: unknown) {
            if (applyActionError(error, "Failed to approve batch", { setUnauthorized })) {
                return;
            }
            throw error;
        } finally {
            setActing(false);
        }
    }, [refresh]);

    const rejectBatch = React.useCallback(async (headerId: number, reason: string) => {
        setActing(true);
        try {
            await api.rejectPriceChangeBatch(headerId, reason);
            toast.success("Batch rejected.");
            await refresh();
        } catch (error: unknown) {
            if (applyActionError(error, "Failed to reject batch", { setUnauthorized })) {
                return;
            }
            throw error;
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
        unauthorized,
        refresh,
        approveBatch,
        rejectBatch,
    };
}
