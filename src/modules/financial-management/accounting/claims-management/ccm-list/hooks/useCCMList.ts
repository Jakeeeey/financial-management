// src/modules/financial-management-system/claims-management/ccm-list/hooks/useCCMList.ts
"use client";

import * as React from "react";
import type { CCMListQuery, CCMRow } from "../utils/types";
import { fetchCCMList } from "../providers/ccmService";

type State = {
    rows: CCMRow[];
    total: number;
    loading: boolean;
    error: string | null;
};

type CCMRowInput = Partial<CCMRow> & {
    supplier_name?: unknown;
    customer_name?: unknown;
    supplier_id?: unknown;
    customer_id?: unknown;
    amount?: unknown;
    applied_amount?: unknown;
    memo_number?: unknown;
    status?: unknown;
};

function safeNumber(v: unknown, fallback = 0): number {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : fallback;
}

function safeStr(v: unknown): string {
    return typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();
}

function toNullableNumber(v: unknown): number | null {
    if (typeof v === "number") {
        return Number.isFinite(v) ? v : null;
    }

    if (v == null) return null;

    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}

function normalizeQuery(query: CCMListQuery): CCMListQuery {
    const page = Math.max(1, Number(query.page ?? 1));
    const pageSize = Math.min(100, Math.max(5, Number(query.pageSize ?? 20)));

    return {
        ...query,
        page,
        pageSize,
    };
}

function normalizeRow(r: CCMRowInput): CCMRow {
    const memo = safeStr(r.memo_number);
    const statusRaw = safeStr(r.status);
    const status: string | null = statusRaw ? statusRaw : null;

    const supplierId = toNullableNumber(r.supplier_id);
    const customerId = toNullableNumber(r.customer_id);

    return {
        ...r,
        memo_number: memo,
        status,
        amount: safeNumber(r.amount ?? 0),
        applied_amount: safeNumber(r.applied_amount ?? 0),
        supplier_id: supplierId,
        supplier_name:
            safeStr(r.supplier_name) || (supplierId ? `Supplier #${supplierId}` : null),
        customer_id: customerId,
        customer_name:
            safeStr(r.customer_name) || (customerId ? `Customer #${customerId}` : null),
    } as CCMRow;
}

export function useCCMList(query: CCMListQuery) {
    const [state, setState] = React.useState<State>({
        rows: [],
        total: 0,
        loading: true,
        error: null,
    });

    const abortRef = React.useRef<AbortController | null>(null);

    const runFetch = React.useCallback(async () => {
        abortRef.current?.abort();
        const ac = new AbortController();
        abortRef.current = ac;

        const normalizedQuery = normalizeQuery(query);

        setState((s) => ({ ...s, loading: true, error: null }));

        try {
            const res = await fetchCCMList(normalizedQuery, ac.signal);

            const total =
                safeNumber(res?.meta?.filter_count ?? res?.meta?.total_count ?? 0) || 0;

            const rowsRaw: CCMRowInput[] = Array.isArray(res?.data) ? res.data : [];
            const rows = rowsRaw.map(normalizeRow);

            if (ac.signal.aborted) return;

            setState({
                rows,
                total,
                loading: false,
                error: null,
            });
        } catch (e: unknown) {
            if (ac.signal.aborted) return;

            const errorMessage = e instanceof Error ? e.message : "Unknown error";

            setState((s) => ({
                ...s,
                loading: false,
                error: errorMessage,
            }));
        }
    }, [query]);

    React.useEffect(() => {
        void runFetch();

        return () => {
            abortRef.current?.abort();
        };
    }, [runFetch]);

    return { ...state, reload: runFetch };
}