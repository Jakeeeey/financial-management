//src/modules/financial-management/claims-management/generate-transmittals/hooks/useAvailableCCMs.ts
"use client";

import * as React from "react";
import type { CCMRow } from "../utils/types";
import { fetchAvailableCCMsBySupplier } from "../providers/transmittalApi";

export function useAvailableCCMs(opts: { supplierId: number | null; enabled: boolean }) {
    const { supplierId, enabled } = opts;

    const [rows, setRows] = React.useState<CCMRow[]>([]);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [tick, setTick] = React.useState(0);

    const reload = React.useCallback(() => setTick((x) => x + 1), []);

    React.useEffect(() => {
        if (!enabled || !supplierId) {
            setRows([]);
            setLoading(false);
            setError(null);
            return;
        }

        const ac = new AbortController();
        setLoading(true);
        setError(null);

        fetchAvailableCCMsBySupplier(supplierId, ac.signal)
            .then(setRows)
            .catch((e) => setError(String(e?.message ?? e)))
            .finally(() => {
                if (!ac.signal.aborted) setLoading(false);
            });

        return () => ac.abort();
    }, [enabled, supplierId, tick]);

    return { rows, loading, error, reload };
}
