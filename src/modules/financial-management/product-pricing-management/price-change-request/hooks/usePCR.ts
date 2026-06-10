"use client";

import * as React from "react";
import { toast } from "sonner";
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
): {
    query: ListQuery;
    setQuery: React.Dispatch<React.SetStateAction<ListQuery>>;
    rows: (PriceChangeRequestRow | CostChangeRequestRow)[];
    total: number;
    loading: boolean;
    refresh: () => Promise<void>;
};

export function usePCRList(initial: UsePCRListInitial): {
    query: ListQuery;
    setQuery: React.Dispatch<React.SetStateAction<ListQuery>>;
    rows: (PriceChangeRequestRow | CostChangeRequestRow)[];
    total: number;
    loading: boolean;
    refresh: () => Promise<void>;
};

export function usePCRList(
    queryOrInitial: ListQuery | UsePCRListInitial,
    setQuery?: React.Dispatch<React.SetStateAction<ListQuery>>,
    options?: UsePCRListOptions,
) {
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

    const refresh = React.useCallback(async () => {
        setLoading(true);
        try {
            const res =
                requestType === "cost"
                    ? await api.listCostRequests(query)
                    : await api.listRequests(query);

            setRows(res.data ?? []);
            setTotal(Number(res.meta?.total_count ?? (res.data?.length ?? 0)));
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, "Failed to load requests"));
        } finally {
            setLoading(false);
        }
    }, [query, requestType]);

    React.useEffect(() => {
        void refresh();
    }, [refresh]);

    return {
        query,
        setQuery: effectiveSetQuery,
        rows,
        total,
        loading,
        refresh,
    };
}
