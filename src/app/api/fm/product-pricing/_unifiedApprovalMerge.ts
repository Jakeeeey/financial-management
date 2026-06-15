export const UNIFIED_FETCH_CHUNK_SIZE = 100;
export const MAX_UNIFIED_FETCH = 5000;

export type UnifiedApprovalRowLike = {
    row_key: string;
    kind: "price_batch" | "cost_batch" | "price_type" | "list_price";
    request_id?: number;
    batch_id?: number;
    requested_at: string | null;
};

function parseRequestedAt(value: string | null | undefined): number {
    if (!value) return 0;
    const time = new Date(value).getTime();
    return Number.isFinite(time) ? time : 0;
}

export function compareUnifiedRows<T extends UnifiedApprovalRowLike>(a: T, b: T): number {
    const timeDiff = parseRequestedAt(b.requested_at) - parseRequestedAt(a.requested_at);
    if (timeDiff !== 0) return timeDiff;

    const kindDiff = a.kind.localeCompare(b.kind);
    if (kindDiff !== 0) return kindDiff;

    const aId = Number(a.request_id ?? a.batch_id ?? 0);
    const bId = Number(b.request_id ?? b.batch_id ?? 0);
    return bId - aId;
}

export function mergeUnifiedRows<T extends UnifiedApprovalRowLike>(
    ...rowGroups: T[][]
): T[] {
    return rowGroups.flat().sort(compareUnifiedRows);
}

export async function fetchStreamTopRows<T>(
    fetchPage: (offset: number, limit: number) => Promise<{ rows: T[]; total: number }>,
    needed: number,
    chunkSize = UNIFIED_FETCH_CHUNK_SIZE,
): Promise<{ rows: T[]; total: number }> {
    const cappedNeeded = Math.min(Math.max(1, needed), MAX_UNIFIED_FETCH);
    const rows: T[] = [];
    let offset = 0;
    let total = 0;

    while (rows.length < cappedNeeded) {
        const remaining = cappedNeeded - rows.length;
        const limit = Math.min(chunkSize, remaining);
        const page = await fetchPage(offset, limit);
        total = page.total;

        if (page.rows.length === 0) break;

        rows.push(...page.rows);
        offset += page.rows.length;

        if (page.rows.length < limit) break;
        if (offset >= total) break;
    }

    return { rows, total };
}
