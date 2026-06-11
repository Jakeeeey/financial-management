import {
    directusHeaders,
    fetchDirectus,
    mustBase,
    nowManila,
} from "../price-change-batches/_batch";

export const CCR = "cost_change_requests";

const PRODUCT_ID_CHUNK_SIZE = 200;

export type CostBulkItemInput = {
    product_id: number;
    proposed_cost: number;
    current_cost?: number | null;
};

export type NormalizedCostBulkItem = {
    product_id: number;
    proposed_cost: number;
    current_cost: number | null;
};

export type CostBulkPlan = {
    itemsToCreate: NormalizedCostBulkItem[];
    skippedDuplicates: number;
    skippedExistingPending: number;
};

type DirectusCostRow = {
    product_id?: number | string | null;
};

type DirectusBulkCreateRow = {
    request_id?: number | string | null;
};

type DirectusList<T> = { data?: T[] };

function chunk<T>(arr: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
}

export async function getExistingPendingCostProductIds(productIds: number[]): Promise<Set<number>> {
    const uniqueIds = Array.from(new Set(productIds.filter((id) => Number.isFinite(id) && id > 0)));
    if (uniqueIds.length === 0) return new Set();

    const pending = new Set<number>();
    const batches = chunk(uniqueIds, PRODUCT_ID_CHUNK_SIZE);

    for (const batch of batches) {
        const params = new URLSearchParams();
        params.set("limit", "500");
        params.set("fields", "product_id");
        params.set("filter[status][_eq]", "PENDING");
        params.set("filter[product_id][_in]", batch.join(","));

        const url = `${mustBase()}/items/${CCR}?${params.toString()}`;
        const json = await fetchDirectus<DirectusList<DirectusCostRow>>(url, { headers: directusHeaders() });

        for (const row of json.data ?? []) {
            const productId = Number(row.product_id);
            if (Number.isFinite(productId) && productId > 0) {
                pending.add(productId);
            }
        }
    }

    return pending;
}

export function normalizeCostBulkItems(rawItems: CostBulkItemInput[]): {
    normalizedItems: NormalizedCostBulkItem[];
    skippedDuplicates: number;
} {
    const seen = new Set<number>();
    const normalizedItems: NormalizedCostBulkItem[] = [];
    let skippedDuplicates = 0;

    for (const item of rawItems) {
        const productId = Number(item.product_id);
        const proposedCost = Number(item.proposed_cost);
        const currentCost = item.current_cost !== undefined ? Number(item.current_cost) : null;

        if (!Number.isFinite(productId) || productId <= 0) continue;
        if (!Number.isFinite(proposedCost)) continue;

        if (seen.has(productId)) {
            skippedDuplicates += 1;
            continue;
        }

        seen.add(productId);
        normalizedItems.push({
            product_id: productId,
            proposed_cost: proposedCost,
            current_cost: Number.isFinite(currentCost) ? currentCost : null,
        });
    }

    return { normalizedItems, skippedDuplicates };
}

export async function planCostBulkCreate(rawItems: CostBulkItemInput[]): Promise<CostBulkPlan> {
    const { normalizedItems, skippedDuplicates } = normalizeCostBulkItems(rawItems);
    const pendingProductIds = await getExistingPendingCostProductIds(
        normalizedItems.map((item) => item.product_id),
    );

    const itemsToCreate = normalizedItems.filter((item) => !pendingProductIds.has(item.product_id));
    const skippedExistingPending = normalizedItems.length - itemsToCreate.length;

    return {
        itemsToCreate,
        skippedDuplicates,
        skippedExistingPending,
    };
}

export async function createPendingCostRequests(args: {
    userId: number;
    itemsToCreate: NormalizedCostBulkItem[];
}) {
    const { userId, itemsToCreate } = args;

    if (itemsToCreate.length === 0) {
        return { created: 0 };
    }

    const payload = itemsToCreate.map((item) => ({
        product_id: item.product_id,
        current_cost: item.current_cost,
        proposed_cost: item.proposed_cost,
        status: "PENDING",
        requested_by: userId,
        requested_at: nowManila(),
    }));

    const createUrl = `${mustBase()}/items/${CCR}`;
    const created = await fetchDirectus<{ data: DirectusBulkCreateRow[] }>(createUrl, {
        method: "POST",
        headers: directusHeaders(),
        body: JSON.stringify(payload),
    });

    return {
        created: (created.data ?? []).length,
    };
}
