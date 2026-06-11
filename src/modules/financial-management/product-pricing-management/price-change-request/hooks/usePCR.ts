"use client";

import * as React from "react";
import type { ListQuery, PriceChangeRequestRow, CostChangeRequestRow } from "../types";
import * as api from "../providers/pcrApi";

function getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) return error.message;
    return fallback;
}

type UsePCRListOptions = {
    requestType?: "price" | "cost";
};

type UsePCRListInitial = Partial<ListQuery> & UsePCRListOptions;

type UsePCRListResult = {
    query: ListQuery;
    setQuery: React.Dispatch<React.SetStateAction<ListQuery>>;
    rows: (PriceChangeRequestRow | CostChangeRequestRow)[];
    total: number;
    loading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
};

function isInitialArg(
    value: ListQuery | UsePCRListInitial,
    setQuery?: React.Dispatch<React.SetStateAction<ListQuery>>,
): value is UsePCRListInitial {
    return setQuery == null;
}

export function usePCRList(
    query: ListQuery,
    setQuery: React.Dispatch<React.SetStateAction<ListQuery>>,
    options?: UsePCRListOptions,
): UsePCRListResult;

export function usePCRList(initial: UsePCRListInitial): UsePCRListResult;

export function usePCRList(
    queryOrInitial: ListQuery | UsePCRListInitial,
    setQuery?: React.Dispatch<React.SetStateAction<ListQuery>>,
    options?: UsePCRListOptions,
): UsePCRListResult {
    const isControlled = setQuery != null;
    const requestType =
        options?.requestType ??
        (isInitialArg(queryOrInitial, setQuery) ? queryOrInitial.requestType : undefined) ??
        "price";

    const [internalQuery, setInternalQuery] = React.useState<ListQuery>(() => {
        if (isControlled) {
            return {
                status: "ALL",
                page: 1,
                page_size: 50,
            };
        }

        const initial = queryOrInitial as UsePCRListInitial;
        const { requestType: _requestType, ...rest } = initial;
        return {
            status: "ALL",
            page: 1,
            page_size: 50,
            ...rest,
        };
    });

    const query = isControlled ? (queryOrInitial as ListQuery) : internalQuery;
    const effectiveSetQuery = isControlled ? setQuery : setInternalQuery;

    const [rows, setRows] = React.useState<(PriceChangeRequestRow | CostChangeRequestRow)[]>([]);
    const [total, setTotal] = React.useState<number>(0);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const loadErrorFallback =
        requestType === "cost" ? "Failed to load list cost requests" : "Failed to load price change requests";

    const refresh = React.useCallback(async () => {
        setLoading(true);
        try {
            const res =
                requestType === "cost"
                    ? await api.listCostRequests(query)
                    : await api.listRequests(query);

            setRows(res.data ?? []);
            setTotal(Number(res.meta?.total_count ?? (res.data?.length ?? 0)));
            setError(null);
        } catch (error: unknown) {
            const message = getErrorMessage(error, loadErrorFallback);
            setRows([]);
            setTotal(0);
            setError(message);
        } finally {
            setLoading(false);
        }
    }, [loadErrorFallback, query, requestType]);

    React.useEffect(() => {
        void refresh();
    }, [refresh]);

    return {
        query,
        setQuery: effectiveSetQuery,
        rows,
        total,
        loading,
        error,
        refresh,
    };
}
