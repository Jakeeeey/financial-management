// src/modules/financial-management/claims-management/for-receiving/hooks/useTransmittalCounts.ts
"use client";

import * as React from "react";
import { fetchTransmittalDetails } from "../providers/receivingApi";

function makeIdsKey(ids: number[]): string {
    // stable key; keep order as-is (same behavior as your join)
    return ids.join(",");
}

export function useTransmittalCounts(transmittalIds: number[]) {
    const [counts, setCounts] = React.useState<Record<number, number>>({});
    const [loadingIds, setLoadingIds] = React.useState<Record<number, boolean>>({});

    // ✅ Extract complex deps to memoized values (satisfies exhaustive-deps)
    const ids = React.useMemo(() => transmittalIds.slice(0, 200), [transmittalIds]);
    const idsKey = React.useMemo(() => makeIdsKey(ids), [ids]);

    React.useEffect(() => {
        if (!ids.length) {
            setCounts({});
            setLoadingIds({});
            return;
        }

        const ac = new AbortController();

        (async () => {
            const nextLoading: Record<number, boolean> = {};
            for (const id of ids) nextLoading[id] = true;
            setLoadingIds(nextLoading);

            const nextCounts: Record<number, number> = {};

            await Promise.allSettled(
                ids.map(async (id) => {
                    const rows = await fetchTransmittalDetails(id, ac.signal);
                    nextCounts[id] = rows.length;
                })
            );

            if (!ac.signal.aborted) {
                setCounts(nextCounts);
                setLoadingIds({});
            }
        })();

        return () => ac.abort();
        // ✅ depend on stable key + ids array reference
    }, [idsKey, ids]);

    return { counts, loadingIds };
}