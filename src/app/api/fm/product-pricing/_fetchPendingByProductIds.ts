import { chunkArray, IN_CHUNK_SIZE } from "./_directusPaging";
import { directusHeaders, fetchDirectus, mustBase } from "./price-change-batches/_batch";

const PCR = "price_change_requests";
const CCR = "cost_change_requests";

export type PendingPcrRow = {
    request_id?: number | string | null;
    product_id?:
        | number
        | string
        | {
              product_id?: number | string | null;
              product_code?: string | null;
              product_name?: string | null;
          }
        | null;
    price_type_id?:
        | number
        | string
        | {
              price_type_id?: number | string | null;
              price_type_name?: string | null;
          }
        | null;
    proposed_price?: number | string | null;
    status?: string | null;
};

export type PendingCcrRow = {
    request_id?: number | string | null;
    product_id?:
        | number
        | string
        | {
              product_id?: number | string | null;
              product_code?: string | null;
              product_name?: string | null;
          }
        | null;
    proposed_cost?: number | string | null;
    status?: string | null;
};

export async function fetchPendingPcrByProductIds(
    productIds: number[],
    status = "PENDING",
): Promise<PendingPcrRow[]> {
    if (productIds.length === 0) return [];

    const fields = [
        "product_id",
        "price_type_id",
        "proposed_price",
        "product_id.product_id",
        "price_type_id.price_type_id",
    ].join(",");

    const batches = chunkArray(productIds, IN_CHUNK_SIZE);
    const results = await Promise.all(
        batches.map(async (batch) => {
            const params = new URLSearchParams();
            params.set("limit", "500");
            params.set("fields", fields);
            params.set("filter[product_id][_in]", batch.join(","));
            if (status) params.set("filter[status][_eq]", status);

            const url = `${mustBase()}/items/${PCR}?${params.toString()}`;
            const json = await fetchDirectus<{ data?: PendingPcrRow[] }>(url, {
                headers: directusHeaders(),
            });
            return json.data ?? [];
        }),
    );

    return results.flat();
}

export async function fetchPendingCcrByProductIds(
    productIds: number[],
    status = "PENDING",
): Promise<PendingCcrRow[]> {
    if (productIds.length === 0) return [];

    const fields = ["product_id", "proposed_cost", "product_id.product_id"].join(",");

    const batches = chunkArray(productIds, IN_CHUNK_SIZE);
    const results = await Promise.all(
        batches.map(async (batch) => {
            const params = new URLSearchParams();
            params.set("limit", "500");
            params.set("fields", fields);
            params.set("filter[product_id][_in]", batch.join(","));
            if (status) params.set("filter[status][_eq]", status);

            const url = `${mustBase()}/items/${CCR}?${params.toString()}`;
            const json = await fetchDirectus<{ data?: PendingCcrRow[] }>(url, {
                headers: directusHeaders(),
            });
            return json.data ?? [];
        }),
    );

    return results.flat();
}
