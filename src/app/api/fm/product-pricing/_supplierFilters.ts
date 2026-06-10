import {
    DETAILS,
    directusHeaders,
    fetchDirectus,
    isRecord,
    mustBase,
} from "./price-change-batches/_batch";

export const PRODUCT_PER_SUPPLIER = "product_per_supplier";

type DirectusSupplierProductRow = {
    product_id?: number | string | { product_id?: number | string | null } | null;
};

type DirectusBatchLineRow = {
    header_id?: number | string | null;
};

export async function getSupplierProductIds(supplierId: string): Promise<number[]> {
    const sp = new URLSearchParams();
    sp.set("limit", "-1");
    sp.set("fields", "product_id,product_id.product_id");
    sp.set("filter[supplier_id][_eq]", supplierId);

    const url = `${mustBase()}/items/${PRODUCT_PER_SUPPLIER}?${sp.toString()}`;
    const res = await fetchDirectus<{ data?: DirectusSupplierProductRow[] }>(url, { headers: directusHeaders() });

    const ids: number[] = [];
    for (const row of res.data ?? []) {
        let n: number | null = null;
        if (typeof row.product_id === "number") {
            n = row.product_id;
        } else if (isRecord(row.product_id) && typeof row.product_id.product_id === "number") {
            n = row.product_id.product_id;
        }
        if (n !== null && Number.isFinite(n) && n > 0) {
            ids.push(n);
        }
    }
    return Array.from(new Set(ids));
}

export async function getBatchHeaderIdsForProducts(productIds: number[]): Promise<number[]> {
    if (productIds.length === 0) return [];

    const sp = new URLSearchParams();
    sp.set("limit", "-1");
    sp.set("fields", "header_id");
    sp.set("filter[product_id][_in]", productIds.join(","));

    const url = `${mustBase()}/items/${DETAILS}?${sp.toString()}`;
    const res = await fetchDirectus<{ data?: DirectusBatchLineRow[] }>(url, { headers: directusHeaders() });

    const ids: number[] = [];
    for (const row of res.data ?? []) {
        const n = Number(row.header_id);
        if (Number.isFinite(n) && n > 0) {
            ids.push(n);
        }
    }
    return Array.from(new Set(ids));
}

export async function resolveBatchSupplierFilter(supplierId: string): Promise<{
    headerIdsFromProducts: number[];
}> {
    const productIds = await getSupplierProductIds(supplierId);
    const headerIdsFromProducts =
        productIds.length > 0 ? await getBatchHeaderIdsForProducts(productIds) : [];
    return { headerIdsFromProducts };
}

export function appendBatchSupplierFilter(
    params: URLSearchParams,
    andIdx: number,
    supplierId: string,
    headerIdsFromProducts: number[],
): number {
    if (!supplierId) return andIdx;

    if (headerIdsFromProducts.length === 0) {
        params.set(`filter[_and][${andIdx}][supplier_id][_eq]`, supplierId);
        return andIdx + 1;
    }

    params.set(`filter[_and][${andIdx}][_or][0][supplier_id][_eq]`, supplierId);
    params.set(`filter[_and][${andIdx}][_or][1][header_id][_in]`, headerIdsFromProducts.join(","));
    return andIdx + 1;
}
