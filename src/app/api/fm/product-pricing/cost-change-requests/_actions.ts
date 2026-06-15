import {
    directusHeaders,
    fetchDirectus,
    isRecord,
    mustBase,
    nowManila,
} from "../price-change-batches/_batch";
import { chunkArray, IN_CHUNK_SIZE } from "../_directusPaging";

export const CCR = "cost_change_requests";
const PRODUCTS = "products";

const CCR_FIELDS = "request_id,product_id,current_cost,proposed_cost,status,requested_by";

export type CcrRow = {
    request_id?: number | string | null;
    product_id?: number | string | null;
    current_cost?: number | string | null;
    proposed_cost?: number | string | null;
    status?: string | null;
    requested_by?: number | string | null;
};

type DirectusSingleResponse<T> = { data: T };
type DirectusList<T> = { data?: T[] };

export function pickRequestId(row: CcrRow): number {
    return Number(row.request_id);
}

export async function getCostRequest(request_id: number): Promise<CcrRow | null> {
    const params = new URLSearchParams();
    params.set("fields", CCR_FIELDS);

    const url = `${mustBase()}/items/${CCR}/${request_id}?${params.toString()}`;
    const json = await fetchDirectus<DirectusSingleResponse<CcrRow>>(url, {
        headers: directusHeaders(),
    });

    return json.data ?? null;
}

export async function fetchCostRequestsByIds(requestIds: number[]): Promise<Map<number, CcrRow>> {
    const uniqueIds = Array.from(new Set(requestIds.filter((id) => Number.isFinite(id) && id > 0)));
    const byId = new Map<number, CcrRow>();

    if (uniqueIds.length === 0) return byId;

    for (const batch of chunkArray(uniqueIds, IN_CHUNK_SIZE)) {
        const params = new URLSearchParams();
        params.set("limit", String(batch.length));
        params.set("fields", CCR_FIELDS);
        params.set("filter[request_id][_in]", batch.join(","));

        const url = `${mustBase()}/items/${CCR}?${params.toString()}`;
        const json = await fetchDirectus<DirectusList<CcrRow>>(url, { headers: directusHeaders() });

        for (const row of json.data ?? []) {
            const requestId = pickRequestId(row);
            if (Number.isFinite(requestId) && requestId > 0) {
                byId.set(requestId, row);
            }
        }
    }

    return byId;
}

async function patchProductCostField(args: { product_id: number; proposed_cost: number }) {
    const { product_id, proposed_cost } = args;
    const url = `${mustBase()}/items/${PRODUCTS}/${product_id}`;

    await fetchDirectus<unknown>(url, {
        method: "PATCH",
        headers: directusHeaders(),
        body: JSON.stringify({ cost_per_unit: proposed_cost }),
    });
}

export async function approveOneCostRequest(
    userId: number,
    request_id: number,
    row: CcrRow,
): Promise<CcrRow> {
    const product_id = Number(row.product_id);
    const proposed_cost = Number(row.proposed_cost);

    if (!Number.isFinite(product_id) || product_id <= 0) {
        throw new Error("Invalid product_id on request.");
    }

    if (!Number.isFinite(proposed_cost)) {
        throw new Error("Invalid proposed_cost on request.");
    }

    await patchProductCostField({ product_id, proposed_cost });

    const url = `${mustBase()}/items/${CCR}/${request_id}`;
    const updated = await fetchDirectus<DirectusSingleResponse<CcrRow>>(url, {
        method: "PATCH",
        headers: directusHeaders(),
        body: JSON.stringify({
            status: "APPROVED",
            approved_by: userId,
            approved_at: nowManila(),
        }),
    });

    return updated.data;
}

export async function rejectOneCostRequest(
    userId: number,
    request_id: number,
    _row: CcrRow,
    reject_reason: string,
): Promise<CcrRow> {
    const url = `${mustBase()}/items/${CCR}/${request_id}`;
    const updated = await fetchDirectus<DirectusSingleResponse<CcrRow>>(url, {
        method: "PATCH",
        headers: directusHeaders(),
        body: JSON.stringify({
            status: "REJECTED",
            rejected_by: userId,
            rejected_at: nowManila(),
            reject_reason,
        }),
    });

    return updated.data;
}

export async function cancelOneCostRequest(
    userId: number,
    request_id: number,
    row: CcrRow,
): Promise<CcrRow> {
    const requested_by = Number(row.requested_by);
    if (requested_by !== userId) {
        throw new Error("You can only cancel your own request.");
    }

    const url = `${mustBase()}/items/${CCR}/${request_id}`;
    const updated = await fetchDirectus<DirectusSingleResponse<CcrRow>>(url, {
        method: "PATCH",
        headers: directusHeaders(),
        body: JSON.stringify({ status: "CANCELLED" }),
    });

    return updated.data;
}

export function actionErrorMessage(error: unknown, fallback = "Request failed"): string {
    if (!(error instanceof Error) || !error.message) return fallback;

    try {
        const parsed: unknown = JSON.parse(error.message);
        if (!isRecord(parsed)) return error.message || fallback;

        const body = typeof parsed.body === "string" ? parsed.body : "";
        if (body) {
            try {
                const bodyParsed: unknown = JSON.parse(body);
                if (isRecord(bodyParsed) && typeof bodyParsed.errors === "object" && bodyParsed.errors) {
                    const first = Array.isArray(bodyParsed.errors) ? bodyParsed.errors[0] : null;
                    if (isRecord(first) && typeof first.message === "string" && first.message) {
                        return first.message;
                    }
                }
            } catch {
                // ignore nested parse errors
            }
        }

        if (typeof parsed.message === "string" && parsed.message) {
            return parsed.message;
        }
    } catch {
        // not a wrapped Directus error
    }

    return error.message || fallback;
}
