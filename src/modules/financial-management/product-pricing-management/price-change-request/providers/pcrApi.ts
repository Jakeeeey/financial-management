import type {
    ActionPayload,
    CreatePriceChangeBatchPayload,
    CreateCCRPayload,
    ListQuery,
    PriceChangeBatchDetail,
    PriceChangeBatchHeader,
    PriceChangeRequestRow,
    CostChangeRequestRow,
    ListMeta,
    UnifiedApprovalRow,
} from "../types";
import { apiStatusParam } from "../utils/pcrQuery";

/** Existing consolidated lookups route */
const LOOKUPS_ENDPOINT = "/api/fm/product-pricing/lookups";

/** Existing products route (DO NOT CHANGE route.ts; we only consume it) */
const PRODUCT_SEARCH_ENDPOINT = "/api/fm/product-pricing/products";

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function toNullableNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === "") return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

function toStringSafe(value: unknown, fallback = ""): string {
    const s = String(value ?? "").trim();
    return s || fallback;
}

async function http<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
    const res = await fetch(input, { cache: "no-store", ...init });
    const text = await res.text().catch(() => "");

    if (!res.ok) {
        try {
            const parsed: unknown = JSON.parse(text);

            if (isRecord(parsed)) {
                const errorMessage =
                    typeof parsed.error === "string"
                        ? parsed.error
                        : typeof parsed.details === "string"
                            ? parsed.details
                            : typeof parsed.message === "string"
                                ? parsed.message
                                : "Request failed";

                throw new Error(errorMessage);
            }

            throw new Error("Request failed");
        } catch {
            throw new Error(text || "Request failed");
        }
    }

    return text ? (JSON.parse(text) as T) : ({} as T);
}

function appendListQuery(sp: URLSearchParams, query: ListQuery) {
    const status = apiStatusParam(query.status);
    if (status) sp.set("status", status);
    if (query.q) sp.set("q", query.q);
    if (query.supplier_id) sp.set("supplier_id", String(query.supplier_id));
    if (query.date_from) sp.set("date_from", query.date_from);
    if (query.date_to) sp.set("date_to", query.date_to);
    sp.set("page", String(query.page ?? 1));
    sp.set("page_size", String(query.page_size ?? 50));
}

export async function listRequests(query: ListQuery) {
    const sp = new URLSearchParams();
    appendListQuery(sp, query);
    if (query.product_id) sp.set("product_id", String(query.product_id));
    if (query.price_type_id) sp.set("price_type_id", String(query.price_type_id));
    if (query.requested_by) sp.set("requested_by", String(query.requested_by));

    return http<{ data: PriceChangeRequestRow[]; meta: ListMeta | null }>(
        `/api/fm/product-pricing/price-change-requests?${sp.toString()}`,
    );
}

export async function listCostRequests(query: ListQuery) {
    const sp = new URLSearchParams();
    appendListQuery(sp, query);
    if (query.product_id) sp.set("product_id", String(query.product_id));
    if (query.requested_by) sp.set("requested_by", String(query.requested_by));

    return http<{ data: CostChangeRequestRow[]; meta: ListMeta | null }>(
        `/api/fm/product-pricing/cost-change-requests?${sp.toString()}`,
    );
}

export async function createCostRequest(payload: CreateCCRPayload) {
    return http<{ data: CostChangeRequestRow }>(`/api/fm/product-pricing/cost-change-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
}

export async function actionCostRequest(payload: ActionPayload) {
    return http<{ data: CostChangeRequestRow }>(`/api/fm/product-pricing/cost-change-requests/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
}

/** Lookups */
export type CategoryOption = { category_id: number; category_name: string };
export type BrandOption = { brand_id: number; brand_name: string };
export type UnitOption = {
    unit_id: number;
    unit_name?: string | null;
    unit_shortcut?: string | null;
    order?: number | null;
};
export type SupplierOption = {
    id: number;
    supplier_name: string;
    supplier_shortcut?: string | null;
    isActive?: number | boolean | null;
};

export type PriceTypeOption = {
    price_type_id: number;
    price_type_name?: string | null;
    sort?: number | null;
};

export type ProductsMeta = {
    page?: number;
    pageSize?: number;
    total?: number;
    totalPages?: number;
    totalVariants?: number;
};

export type LookupsResponse = {
    categories: CategoryOption[];
    brands: BrandOption[];
    units: UnitOption[];
    suppliers: SupplierOption[];
};

export async function getLookups(params?: {
    supplier_scope?: "ALL" | "LINKED_ONLY";
    supplier_ids?: string;
    category_id?: number | null;
    brand_id?: number | null;
}) {
    const sp = new URLSearchParams();
    if (params?.supplier_scope) sp.set("supplier_scope", params.supplier_scope);
    if (params?.supplier_ids) sp.set("supplier_ids", params.supplier_ids);
    if (params?.category_id) sp.set("category_id", String(params.category_id));
    if (params?.brand_id) sp.set("brand_id", String(params.brand_id));

    const url = sp.toString() ? `${LOOKUPS_ENDPOINT}?${sp.toString()}` : LOOKUPS_ENDPOINT;

    const res = await http<{ data: LookupsResponse }>(url);
    const d = res.data ?? ({} as LookupsResponse);

    return {
        categories: Array.isArray(d.categories) ? d.categories : [],
        brands: Array.isArray(d.brands) ? d.brands : [],
        units: Array.isArray(d.units) ? d.units : [],
        suppliers: Array.isArray(d.suppliers) ? d.suppliers : [],
    };
}

/** Products */
export type ProductSearchRow = {
    product_id: number;
    product_name: string;
    parent_id?: number | null;
    product_code?: string | null;
    barcode?: string | null;
    __group_id?: number | null;
    unit_of_measurement?: number | null;
    price_per_unit?: number | null;
    priceA?: number | null;
    priceB?: number | null;
    priceC?: number | null;
    priceD?: number | null;
    priceE?: number | null;
};

function mapProductSearchRow(item: unknown): ProductSearchRow | null {
    if (!isRecord(item)) return null;

    const productId = Number(item.product_id ?? 0);
    if (!Number.isFinite(productId) || productId <= 0) return null;

    return {
        product_id: productId,
        product_name: toStringSafe(item.product_name, "-"),
        parent_id: toNullableNumber(item.parent_id),
        product_code: toStringSafe(item.product_code) || null,
        barcode: toStringSafe(item.barcode) || null,
        __group_id: toNullableNumber(item.__group_id),
        unit_of_measurement: toNullableNumber(item.unit_of_measurement),
        price_per_unit: toNullableNumber(item.price_per_unit),
        priceA: toNullableNumber(item.priceA),
        priceB: toNullableNumber(item.priceB),
        priceC: toNullableNumber(item.priceC),
        priceD: toNullableNumber(item.priceD),
        priceE: toNullableNumber(item.priceE),
    };
}

export async function getPriceTypes() {
    const res = await http<{ data: PriceTypeOption[] }>("/api/fm/product-pricing/price-types");
    return {
        data: (res.data ?? [])
            .map((item) => ({
                price_type_id: Number(item.price_type_id),
                price_type_name: item.price_type_name ?? "",
                sort: toNullableNumber(item.sort),
            }))
            .filter((item) => Number.isFinite(item.price_type_id) && item.price_type_id > 0),
    };
}

export async function searchProducts(params: {
    q: string;
    limit?: number;
    category_id?: number | null;
    brand_id?: number | null;
    supplier_scope?: "ALL" | "LINKED_ONLY";
    supplier_ids?: string;
}) {
    const sp = new URLSearchParams();
    sp.set("q", params.q ?? "");
    sp.set("page", "1");
    sp.set("page_size", String(params.limit ?? 25));

    if (params.category_id) sp.set("category_id", String(params.category_id));
    if (params.brand_id) sp.set("brand_id", String(params.brand_id));

    if (params.supplier_scope) sp.set("supplier_scope", params.supplier_scope);
    if (params.supplier_ids) sp.set("supplier_ids", params.supplier_ids);

    const res = await fetch(`${PRODUCT_SEARCH_ENDPOINT}?${sp.toString()}`, { cache: "no-store" });
    const json: unknown = await res.json().catch(() => null);

    if (!res.ok) {
        let message = `Request failed (${res.status})`;

        if (isRecord(json)) {
            message =
                typeof json.error === "string"
                    ? json.error
                    : typeof json.details === "string"
                        ? json.details
                        : typeof json.message === "string"
                            ? json.message
                            : message;
        }

        throw new Error(message);
    }

    const raw = isRecord(json) ? (Array.isArray(json.data) ? json.data : json) : json;
    const list: unknown[] = Array.isArray(raw) ? raw : [];

    return list
        .map((item): ProductSearchRow | null => {
            if (!isRecord(item)) return null;

            const productId = Number(item.product_id ?? 0);
            if (!Number.isFinite(productId) || productId <= 0) return null;

            return {
                product_id: productId,
                product_name: toStringSafe(item.product_name, "—"),
                unit_of_measurement: toNullableNumber(item.unit_of_measurement),
                price_per_unit: toNullableNumber(item.price_per_unit),
                priceA: toNullableNumber(item.priceA),
                priceB: toNullableNumber(item.priceB),
                priceC: toNullableNumber(item.priceC),
                priceD: toNullableNumber(item.priceD),
                priceE: toNullableNumber(item.priceE),
            };
        })
        .filter((row): row is ProductSearchRow => row !== null);
}

export async function getProductsPage(params: {
    q?: string;
    supplier_ids?: string;
    supplier_scope?: "ALL" | "LINKED_ONLY";
    active_only?: "0" | "1";
    page?: string;
    page_size?: string;
}) {
    const sp = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null) continue;
        const text = String(value).trim();
        if (!text) continue;
        sp.set(key, text);
    }

    const res = await http<{ data: unknown[]; meta?: ProductsMeta }>(
        `/api/fm/product-pricing/products?${sp.toString()}`,
    );

    return {
        data: (res.data ?? [])
            .map(mapProductSearchRow)
            .filter((row): row is ProductSearchRow => row !== null),
        meta: res.meta ?? null,
    };
}

export async function listPriceChangeBatches(query: ListQuery) {
    const sp = new URLSearchParams();
    appendListQuery(sp, query);

    return http<{ data: PriceChangeBatchHeader[]; meta: ListMeta | null }>(
        `/api/fm/product-pricing/price-change-batches?${sp.toString()}`,
    );
}

export async function listUnifiedApprovals(query: ListQuery) {
    const sp = new URLSearchParams();
    appendListQuery(sp, query);

    return http<{ data: UnifiedApprovalRow[]; meta: ListMeta | null }>(
        `/api/fm/product-pricing/price-change-approvals?${sp.toString()}`,
    );
}

export async function getPriceChangeBatch(headerId: number) {
    return http<{ data: PriceChangeBatchDetail }>(
        `/api/fm/product-pricing/price-change-batches/${headerId}`,
    );
}

export async function createPriceChangeBatch(payload: CreatePriceChangeBatchPayload) {
    return http<{
        data: PriceChangeBatchHeader;
        created: number;
        skipped_duplicates?: number;
        skipped_existing_pending?: number;
    }>(`/api/fm/product-pricing/price-change-batches`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
}

export async function approvePriceChangeBatch(headerId: number) {
    return http<{ ok: boolean; header_id: number; affected: number }>(
        `/api/fm/product-pricing/price-change-batches/${headerId}/approve`,
        { method: "POST" },
    );
}

export async function rejectPriceChangeBatch(headerId: number, reject_reason: string) {
    return http<{ ok: boolean; header_id: number; rejected: number }>(
        `/api/fm/product-pricing/price-change-batches/${headerId}/reject`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reject_reason }),
        },
    );
}
