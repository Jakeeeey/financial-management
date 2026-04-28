// src/modules/supply-chain-management/product-pricing-management/product-pricing/providers/pricingApi.ts
import type {
    Brand,
    Category,
    PriceRow,
    PriceType,
    ProductRow,
    Unit,
    UpsertLine,
    Supplier,
} from "../types";
import { http } from "./fetchProvider";

type ProductsMeta = {
    total?: number;
    page?: number;
    page_size?: number;
    pageCount?: number;
    [key: string]: string | number | boolean | null | undefined;
};

export async function getPriceTypes() {
    return http<{ data: PriceType[] }>("/api/fm/product-pricing/price-types");
}

export async function createPriceType(data: Partial<PriceType>) {
    return http<{ data: PriceType }>("/api/fm/product-pricing/price-types", {
        method: "POST",
        body: JSON.stringify(data),
    });
}

export async function updatePriceType(id: number, data: Partial<PriceType>) {
    return http<{ data: PriceType }>(`/api/fm/product-pricing/price-types/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
    });
}

export async function deletePriceType(id: number) {
    return http<{ ok: boolean }>(`/api/fm/product-pricing/price-types/${id}`, {
        method: "DELETE",
    });
}

export async function getLookups(params?: {
    supplier_ids?: string;
    supplier_scope?: "ALL" | "LINKED_ONLY";
    category_id?: string;
    brand_id?: string;
}) {
    const sp = new URLSearchParams();
    if (params?.supplier_ids) sp.set("supplier_ids", String(params.supplier_ids));
    if (params?.supplier_scope) sp.set("supplier_scope", String(params.supplier_scope));
    if (params?.category_id) sp.set("category_id", String(params.category_id));
    if (params?.brand_id) sp.set("brand_id", String(params.brand_id));

    const qs = sp.toString();
    return http<{ data: { categories: Category[]; brands: Brand[]; units: Unit[]; suppliers?: Supplier[] } }>(
        `/api/fm/product-pricing/lookups${qs ? `?${qs}` : ""}`,
    );
}

export async function getProducts(params: {
    q?: string;
    category_id?: string;
    category_ids?: string;
    brand_id?: string;
    brand_ids?: string;
    unit_id?: string;
    unit_ids?: string;
    supplier_id?: string;
    supplier_ids?: string;
    supplier_scope?: "ALL" | "LINKED_ONLY";
    active_only?: "0" | "1";
    missing_tier?: "0" | "1";
    page?: string;
    page_size?: string;
}) {
    const sp = new URLSearchParams();

    for (const [k, v] of Object.entries(params)) {
        if (v === undefined || v === null) continue;
        const s = String(v).trim();
        if (!s || s === "undefined" || s === "null") continue;
        sp.set(k, s);
    }

    return http<{ data: ProductRow[]; meta: ProductsMeta }>(
        `/api/fm/product-pricing/products?${sp.toString()}`,
    );
}

export async function getPrintProducts(params: {
    q?: string;
    category_id?: string;
    category_ids?: string;
    brand_id?: string;
    brand_ids?: string;
    unit_id?: string;
    unit_ids?: string;
    supplier_id?: string;
    supplier_ids?: string;
    supplier_scope?: "ALL" | "LINKED_ONLY";
    active_only?: "0" | "1";
    missing_tier?: "0" | "1";
}) {
    const sp = new URLSearchParams();

    for (const [k, v] of Object.entries(params)) {
        if (v === undefined || v === null) continue;
        const s = String(v).trim();
        if (!s || s === "undefined" || s === "null") continue;
        sp.set(k, s);
    }

    return http<{ data: ProductRow[] }>(
        `/api/fm/product-pricing/print/products?${sp.toString()}`,
    );
}

export async function getPricesForProducts(productIds: number[]) {
    const sp = new URLSearchParams({ product_ids: productIds.join(",") });
    return http<{ data: PriceRow[] }>(`/api/fm/product-pricing/prices?${sp.toString()}`);
}

export async function upsertPrices(lines: UpsertLine[]) {
    return http<{ ok: boolean; affected: number }>(`/api/fm/product-pricing/prices-upsert`, {
        method: "POST",
        body: JSON.stringify({ lines }),
    });
}

export async function createPriceChangeRequests(items: {
    product_id: number;
    price_type_id: number;
    proposed_price: number;
}[]) {
    return http<{
        created: number;
        skipped_duplicates?: number;
        skipped_existing_pending?: number;
    }>(`/api/fm/product-pricing/price-change-requests/bulk`, {
        method: "POST",
        body: JSON.stringify({ items }),
    });
}

export async function bulkUpdateProducts(items: { product_id: number; cost_per_unit: number | null }[]) {
    return http<{ ok: boolean; affected: number }>(`/api/fm/product-pricing/products/bulk-patch`, {
        method: "POST",
        body: JSON.stringify({ items }),
    });
}

export async function createCostChangeRequests(
    items: {
        product_id: number;
        proposed_cost: number;
        current_cost?: number | null;
    }[],
) {
    return http<{
        created: number;
        skipped_duplicates?: number;
        skipped_existing_pending?: number;
    }>(`/api/fm/product-pricing/cost-change-requests/bulk`, {
        method: "POST",
        body: JSON.stringify({ items }),
    });
}