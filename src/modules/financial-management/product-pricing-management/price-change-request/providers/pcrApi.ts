import type {
    ActionPayload,
    CreatePCRPayload,
    ListQuery,
    PriceChangeRequestRow,
    ListMeta,
} from "../types";

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

export async function listRequests(query: ListQuery) {
    const sp = new URLSearchParams();
    if (query.status) sp.set("status", query.status);
    if (query.q) sp.set("q", query.q);
    if (query.product_id) sp.set("product_id", String(query.product_id));
    if (query.price_type_id) sp.set("price_type_id", String(query.price_type_id));
    if (query.requested_by) sp.set("requested_by", String(query.requested_by));
    sp.set("page", String(query.page ?? 1));
    sp.set("page_size", String(query.page_size ?? 50));

    return http<{ data: PriceChangeRequestRow[]; meta: ListMeta | null }>(
        `/api/fm/product-pricing/price-change-requests?${sp.toString()}`,
    );
}

export async function createRequest(payload: CreatePCRPayload) {
    return http<{ data: PriceChangeRequestRow }>(`/api/fm/product-pricing/price-change-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
}

export async function actionRequest(payload: ActionPayload) {
    return http<{ data: PriceChangeRequestRow }>(`/api/fm/product-pricing/price-change-requests/actions`, {
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
    unit_of_measurement?: number | null;
    price_per_unit?: number | null;
    priceA?: number | null;
    priceB?: number | null;
    priceC?: number | null;
    priceD?: number | null;
    priceE?: number | null;
};

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