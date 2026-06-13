import type { BulkActionResult, PriceTypeSelectionSnapshot } from "../types";

function emptyBulkResult(action: BulkActionResult["action"]): BulkActionResult {
    return { action, successIds: [], failedIds: [], failures: [] };
}

export function groupSnapshotsByBatch(
    snapshots: PriceTypeSelectionSnapshot[],
): Map<number, PriceTypeSelectionSnapshot[]> {
    const groups = new Map<number, PriceTypeSelectionSnapshot[]>();

    for (const snapshot of snapshots) {
        const headerId = Number(snapshot.batch_header_id);
        if (!Number.isFinite(headerId) || headerId <= 0) continue;

        const existing = groups.get(headerId) ?? [];
        existing.push(snapshot);
        groups.set(headerId, existing);
    }

    return groups;
}

export function uniqueBatchCount(snapshots: PriceTypeSelectionSnapshot[]): number {
    return groupSnapshotsByBatch(snapshots).size;
}

export async function approveManyBatches(
    snapshots: PriceTypeSelectionSnapshot[],
    approveBatch: (headerId: number) => Promise<void>,
): Promise<BulkActionResult> {
    const groups = groupSnapshotsByBatch(snapshots);
    if (groups.size === 0) return emptyBulkResult("approve");

    const successIds: number[] = [];
    const failedIds: number[] = [];
    const failures: BulkActionResult["failures"] = [];

    for (const [headerId, batchSnapshots] of groups) {
        const requestIds = batchSnapshots.map((item) => item.request_id);
        try {
            await approveBatch(headerId);
            successIds.push(...requestIds);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "Batch approval failed";
            failedIds.push(...requestIds);
            for (const requestId of requestIds) {
                failures.push({ request_id: requestId, message });
            }
        }
    }

    return { action: "approve", successIds, failedIds, failures };
}

export async function rejectManyBatches(
    snapshots: PriceTypeSelectionSnapshot[],
    reason: string,
    rejectBatch: (headerId: number, rejectReason: string) => Promise<void>,
): Promise<BulkActionResult> {
    const groups = groupSnapshotsByBatch(snapshots);
    if (groups.size === 0) return emptyBulkResult("reject");

    const successIds: number[] = [];
    const failedIds: number[] = [];
    const failures: BulkActionResult["failures"] = [];

    for (const [headerId, batchSnapshots] of groups) {
        const requestIds = batchSnapshots.map((item) => item.request_id);
        try {
            await rejectBatch(headerId, reason);
            successIds.push(...requestIds);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "Batch rejection failed";
            failedIds.push(...requestIds);
            for (const requestId of requestIds) {
                failures.push({ request_id: requestId, message });
            }
        }
    }

    return { action: "reject", successIds, failedIds, failures };
}
