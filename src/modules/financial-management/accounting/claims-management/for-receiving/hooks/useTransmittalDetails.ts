//src/modules/financial-management/claims-management/for-receiving/hooks/useTransmittalDetails.ts
"use client";

import * as React from "react";
import type { TransmittalDetailRow } from "../utils/types";
import { fetchTransmittalDetails } from "../providers/receivingApi";

export function useTransmittalDetails(transmittalId: number | null, enabled: boolean) {
    const [rows, setRows] = React.useState<TransmittalDetailRow[]>([]);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [tick, setTick] = React.useState(0);

    const reload = React.useCallback(() => setTick((x) => x + 1), []);

    React.useEffect(() => {
        if (!enabled || !transmittalId) {
            setRows([]);
            setLoading(false);
            setError(null);
            return;
        }

        const ac = new AbortController();

        // Only show "hard" loading if we have no data
        const isInitial = rows.length === 0;
        if (isInitial) {
            setLoading(true);
        }
        setError(null);

        fetchTransmittalDetails(transmittalId, ac.signal)
            .then(setRows)
            .catch((e) => setError(String(e?.message ?? e)))
            .finally(() => {
                if (!ac.signal.aborted) setLoading(false);
            });

        return () => ac.abort();
    }, [transmittalId, enabled, tick, rows.length]);

    return { rows, loading, error, reload };
}
