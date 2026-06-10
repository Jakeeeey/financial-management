"use client";

import * as React from "react";

import type { ListCostSelectionSnapshot } from "../types";
import { countOffPageSelected, visibleRequestIdsOnPage } from "../utils/selectionScope";

type RowWithRequestId = {
    request_id?: number | string | null;
};

type Options<TRow extends RowWithRequestId> = {
    rows: TRow[];
    isSelectable: (row: TRow) => boolean;
    toSnapshot: (row: TRow) => ListCostSelectionSnapshot;
};

function fallbackSnapshot(requestId: number): ListCostSelectionSnapshot {
    return {
        request_id: requestId,
        record_label: `CCR-${requestId}`,
        product_label: `CCR-${requestId}`,
        current_cost: null,
        proposed_cost: 0,
    };
}

export function useListCostBulkSelection<TRow extends RowWithRequestId>({
    rows,
    isSelectable,
    toSnapshot,
}: Options<TRow>) {
    const [selectionMap, setSelectionMap] = React.useState<Map<number, ListCostSelectionSnapshot>>(
        () => new Map(),
    );

    const selectableRowsOnPage = React.useMemo(
        () => rows.filter(isSelectable),
        [rows, isSelectable],
    );

    const visiblePageIds = React.useMemo(() => visibleRequestIdsOnPage(rows), [rows]);

    const selectedIds = React.useMemo(() => Array.from(selectionMap.keys()), [selectionMap]);
    const selectedSnapshots = React.useMemo(() => Array.from(selectionMap.values()), [selectionMap]);

    const offPageSelectedCount = React.useMemo(
        () => countOffPageSelected(selectedIds, visiblePageIds),
        [selectedIds, visiblePageIds],
    );

    const onPageSelectedCount = React.useMemo(
        () => selectedIds.filter((id) => visiblePageIds.has(id)).length,
        [selectedIds, visiblePageIds],
    );

    const toggleSelect = React.useCallback(
        (id: number, checked: boolean, row?: TRow) => {
            setSelectionMap((prev) => {
                const next = new Map(prev);
                if (checked) {
                    if (row) {
                        next.set(id, toSnapshot(row));
                    } else if (!next.has(id)) {
                        next.set(id, fallbackSnapshot(id));
                    }
                } else {
                    next.delete(id);
                }
                return next;
            });
        },
        [toSnapshot],
    );

    const toggleSelectAllPage = React.useCallback(
        (checked: boolean) => {
            setSelectionMap((prev) => {
                const next = new Map(prev);
                if (checked) {
                    for (const row of selectableRowsOnPage) {
                        const id = Number(row.request_id);
                        if (Number.isFinite(id)) {
                            next.set(id, toSnapshot(row));
                        }
                    }
                } else {
                    for (const row of selectableRowsOnPage) {
                        const id = Number(row.request_id);
                        if (Number.isFinite(id)) {
                            next.delete(id);
                        }
                    }
                }
                return next;
            });
        },
        [selectableRowsOnPage, toSnapshot],
    );

    const clearSelection = React.useCallback(() => {
        setSelectionMap(new Map());
    }, []);

    const removeSelectionIds = React.useCallback((ids: number[]) => {
        if (ids.length === 0) return;
        setSelectionMap((prev) => {
            const next = new Map(prev);
            for (const id of ids) {
                next.delete(id);
            }
            return next;
        });
    }, []);

    return {
        selectionMap,
        selectedIds,
        selectedSnapshots,
        offPageSelectedCount,
        onPageSelectedCount,
        toggleSelect,
        toggleSelectAllPage,
        clearSelection,
        removeSelectionIds,
    };
}
