// src/modules/financial-management/claims-management/for-payment/hooks/usePaymentTransmittalDetails.ts
"use client";

import * as React from "react";
import type { TransmittalDetailRow } from "../utils/types";
import { fetchTransmittalDetails } from "../providers/paymentApi";

function isAbortLikeError(e: unknown): boolean {
    if (e instanceof DOMException && e.name === "AbortError") return true;

    if (e && typeof e === "object") {
        const rec = e as Record<string, unknown>;
        const name = typeof rec["name"] === "string" ? rec["name"] : "";
        if (name === "AbortError") return true;

        const msg = typeof rec["message"] === "string" ? rec["message"] : "";
        return /aborted|abort/i.test(msg);
    }

    return /aborted|abort/i.test(String(e));
}

function errorMessage(e: unknown): string {
    if (e instanceof Error) return e.message;
    return String(e);
}

export function usePaymentTransmittalDetails(
    transmittalId: number | null,
    enabled: boolean
) {
    const [rows, setRows] = React.useState<TransmittalDetailRow[]>([]);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState<string>("");

    const [tick, setTick] = React.useState(0);
    const reload = React.useCallback(() => setTick((t) => t + 1), []);

    React.useEffect(() => {
        if (!enabled || !transmittalId) {
            setRows([]);
            setError("");
            setLoading(false);
            return;
        }

        const ac = new AbortController();

        (async () => {
            try {
                setLoading(true);
                setError("");

                // Keep provider signature: (id: number) => Promise<TransmittalDetailRow[]>
                const data = await fetchTransmittalDetails(transmittalId);

                if (ac.signal.aborted) return;
                setRows(Array.isArray(data) ? data : []);
            } catch (e: unknown) {
                if (ac.signal.aborted || isAbortLikeError(e)) return;
                setRows([]);
                setError(errorMessage(e));
            } finally {
                if (!ac.signal.aborted) setLoading(false);
            }
        })();

        return () => ac.abort();
    }, [enabled, transmittalId, tick]);

    return { rows, loading, error, reload };
}