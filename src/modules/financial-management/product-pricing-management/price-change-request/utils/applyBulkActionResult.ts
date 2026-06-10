import type { BulkActionResult, ListCostSelectionSnapshot } from "../types";

export type BulkActionOutcome = {
    result: BulkActionResult;
    snapshots: ListCostSelectionSnapshot[];
};

export function applyBulkActionResult(
    result: BulkActionResult,
    snapshots: ListCostSelectionSnapshot[],
    removeSelectionIds: (ids: number[]) => void,
    setBulkActionOutcome: (outcome: BulkActionOutcome | null) => void,
) {
    if (result.successIds.length > 0) {
        removeSelectionIds(result.successIds);
    }
    if (result.failedIds.length > 0) {
        setBulkActionOutcome({ result, snapshots });
    } else {
        setBulkActionOutcome(null);
    }
}
