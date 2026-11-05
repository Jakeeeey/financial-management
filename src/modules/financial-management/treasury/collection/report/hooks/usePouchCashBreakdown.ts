"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchProvider } from "../../providers/fetchProvider";

interface RawCashBucket {
    tempId?: string;
    paymentMethodId?: number | null;
    coaId?: number | null;
    amount?: number;
    quantity?: number | null;
}

interface RawPouchCashDetails {
    cashBuckets?: RawCashBucket[];
}

interface CashDenominationRow {
    key: string;
    denomination: number | null;
    quantity: number | null;
    amount: number;
}

interface CashBreakdownState {
    rows: CashDenominationRow[];
    countedTotal: number;
    completedKey: string | null;
    error: string | null;
}

const EMPTY_STATE: CashBreakdownState = {
    rows: [],
    countedTotal: 0,
    completedKey: null,
    error: null,
};

const toAmount = (value?: number | null) => {
    const amount = Number(value ?? 0);
    return Number.isFinite(amount) ? Math.abs(amount) : 0;
};

const isCashBucket = (bucket: RawCashBucket) =>
    Boolean(bucket.tempId?.toLowerCase().startsWith("cash-")) ||
    (bucket.coaId === 1 && bucket.paymentMethodId == null);

function buildDenominationRows(buckets?: RawCashBucket[]): CashDenominationRow[] {
    if (!buckets?.length) return [];

    const grouped = new Map<string, { key: string; amount: number; quantity: number | null }>();

    for (const bucket of buckets) {
        if (!isCashBucket(bucket)) continue;

        const amount = toAmount(bucket.amount);
        const quantity = bucket.quantity != null && bucket.quantity > 0 ? bucket.quantity : null;
        const key = bucket.tempId?.trim() || `cash-${bucket.coaId ?? "entry"}`;
        const existing = grouped.get(key);

        if (existing) {
            existing.amount += amount;
            existing.quantity = existing.quantity != null && quantity != null
                ? existing.quantity + quantity
                : existing.quantity ?? quantity;
            continue;
        }

        grouped.set(key, { key, amount, quantity });
    }

    return Array.from(grouped.values())
        .map((row) => ({
            ...row,
            denomination: row.quantity != null && row.quantity > 0 ? row.amount / row.quantity : null,
        }))
        .sort((a, b) => (b.denomination ?? -1) - (a.denomination ?? -1));
}

export function usePouchCashBreakdown(pouchId: number | null, enabled: boolean) {
    const [state, setState] = useState<CashBreakdownState>(EMPTY_STATE);
    const [requestVersion, setRequestVersion] = useState(0);
    const requestSequence = useRef(0);

    useEffect(() => {
        if (!enabled || pouchId == null) return;

        const requestKey = `${pouchId}:${requestVersion}`;
        const requestId = ++requestSequence.current;
        const controller = new AbortController();

        const loadBreakdown = async () => {
            try {
                const data = await fetchProvider.getOrThrow<RawPouchCashDetails>(
                    `/api/fm/treasury/collections/${pouchId}`,
                    { signal: controller.signal },
                );
                if (controller.signal.aborted || requestId !== requestSequence.current) return;

                const rows = buildDenominationRows(data?.cashBuckets);
                setState({
                    rows,
                    countedTotal: rows.reduce((total, row) => total + row.amount, 0),
                    completedKey: requestKey,
                    error: null,
                });
            } catch (error) {
                if (controller.signal.aborted || requestId !== requestSequence.current) return;

                setState({
                    rows: [],
                    countedTotal: 0,
                    completedKey: requestKey,
                    error: error instanceof Error && error.message
                        ? error.message
                        : "Cash breakdown could not be loaded.",
                });
            }
        };

        void loadBreakdown();

        return () => {
            controller.abort();
        };
    }, [enabled, pouchId, requestVersion]);

    const retry = useCallback(() => setRequestVersion((version) => version + 1), []);
    const requestKey = enabled && pouchId != null ? `${pouchId}:${requestVersion}` : null;
    const isResolved = requestKey != null && state.completedKey === requestKey;

    return {
        rows: isResolved ? state.rows : [],
        countedTotal: isResolved ? state.countedTotal : 0,
        isLoading: requestKey != null && !isResolved,
        error: isResolved ? state.error : null,
        retry,
    };
}
