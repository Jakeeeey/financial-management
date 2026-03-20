// src/app/api/product-pricing/lookups/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIRECTUS_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN || "";

const CATEGORIES = "categories";
const BRAND = "brand";
const UNITS = "units";
const SUPPLIERS = "suppliers";

const PRODUCT_PER_SUPPLIER = "product_per_supplier";
const PRODUCTS = "products";

type DirectusCategory = {
    category_id?: number | string | null;
    category_name?: string | null;
};

type DirectusBrand = {
    brand_id?: number | string | null;
    brand_name?: string | null;
};

type DirectusUnit = {
    unit_id?: number | string | null;
    unit_name?: string | null;
    unit_shortcut?: string | null;
    order?: number | string | null;
};

type DirectusSupplier = {
    id?: number | string | null;
    supplier_name?: string | null;
    supplier_shortcut?: string | null;
    isActive?: number | string | boolean | null;
};

type DirectusProductLookupRow = {
    product_id?: number | string | null;
    product_category?: DirectusCategory | null;
    product_brand?: DirectusBrand | null;
    unit_of_measurement?: DirectusUnit | null;
};

type ProductPerSupplierRow = {
    product_id?: number | string | null;
};

type JwtPayload = {
    sub?: string | number | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function directusHeaders() {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (DIRECTUS_TOKEN) h.Authorization = `Bearer ${DIRECTUS_TOKEN}`;
    return h;
}

async function fetchDirectus<T>(url: string): Promise<T> {
    const res = await fetch(url, { cache: "no-store", headers: directusHeaders() });
    if (!res.ok) throw new Error(await res.text());
    return (await res.json()) as T;
}

function decodeUserIdFromJwtCookie(req: NextRequest, cookieName = "vos_access_token") {
    const token = req.cookies.get(cookieName)?.value;
    if (!token) return null;

    const parts = token.split(".");
    if (parts.length < 2) return null;

    try {
        const payloadPart = parts[1];
        const pad = "=".repeat((4 - (payloadPart.length % 4)) % 4);
        const b64 = (payloadPart + pad).replace(/-/g, "+").replace(/_/g, "/");
        const jsonStr = Buffer.from(b64, "base64").toString("utf8");
        const payloadUnknown: unknown = JSON.parse(jsonStr);

        if (!isRecord(payloadUnknown)) return null;

        const payload = payloadUnknown as JwtPayload;
        const userId = Number(payload.sub);
        return Number.isFinite(userId) ? userId : null;
    } catch {
        return null;
    }
}

function uniqById<T extends Record<string, unknown>, K extends keyof T>(rows: T[], idKey: K) {
    const map = new Map<string, T>();

    for (const row of rows) {
        const id = row[idKey];
        if (id === undefined || id === null) continue;

        const key = String(id);
        if (!map.has(key)) map.set(key, row);
    }

    return Array.from(map.values());
}

function chunk<T>(arr: T[], size: number) {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
}

function safeCsvIds(v: string | null) {
    const s = String(v ?? "").trim();
    if (!s) return [];

    return s
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean)
        .filter((x) => /^\d+$/.test(x));
}

function safeInt(v: string | null) {
    const n = Number(String(v ?? "").trim());
    return Number.isFinite(n) ? n : 0;
}

async function collectSetsFromProducts(args: {
    productIds?: number[];
    categoryId?: number;
    brandId?: number;
}) {
    const { productIds, categoryId = 0, brandId = 0 } = args;

    const catSet = new Set<string>();
    const brandSet = new Set<string>();
    const unitSet = new Set<string>();

    const fields = [
        "product_id",
        "product_category.category_id",
        "product_category.category_name",
        "product_brand.brand_id",
        "product_brand.brand_name",
        "unit_of_measurement.unit_id",
        "unit_of_measurement.unit_name",
        "unit_of_measurement.unit_shortcut",
        "unit_of_measurement.order",
    ].join(",");

    const applyFilters = (sp: URLSearchParams) => {
        sp.set("limit", "-1");
        sp.set("fields", fields);

        if (categoryId > 0) {
            sp.set("filter[product_category][category_id][_eq]", String(categoryId));
        }
        if (brandId > 0) {
            sp.set("filter[product_brand][brand_id][_eq]", String(brandId));
        }
    };

    if (Array.isArray(productIds) && productIds.length > 0) {
        const batches = chunk(productIds, 300);

        for (const batch of batches) {
            const sp = new URLSearchParams();
            applyFilters(sp);
            sp.set("filter[product_id][_in]", batch.join(","));

            const prodJson = await fetchDirectus<{ data: DirectusProductLookupRow[] }>(
                `${DIRECTUS_URL}/items/${PRODUCTS}?${sp.toString()}`,
            );
            const prods = Array.isArray(prodJson.data) ? prodJson.data : [];

            for (const p of prods) {
                const c = p.product_category;
                const b = p.product_brand;
                const u = p.unit_of_measurement;

                if (c?.category_id != null) catSet.add(String(c.category_id));
                if (b?.brand_id != null) brandSet.add(String(b.brand_id));
                if (u?.unit_id != null) unitSet.add(String(u.unit_id));
            }
        }

        return { catSet, brandSet, unitSet };
    }

    const sp = new URLSearchParams();
    applyFilters(sp);

    const prodJson = await fetchDirectus<{ data: DirectusProductLookupRow[] }>(
        `${DIRECTUS_URL}/items/${PRODUCTS}?${sp.toString()}`,
    );
    const prods = Array.isArray(prodJson.data) ? prodJson.data : [];

    for (const p of prods) {
        const c = p.product_category;
        const b = p.product_brand;
        const u = p.unit_of_measurement;

        if (c?.category_id != null) catSet.add(String(c.category_id));
        if (b?.brand_id != null) brandSet.add(String(b.brand_id));
        if (u?.unit_id != null) unitSet.add(String(u.unit_id));
    }

    return { catSet, brandSet, unitSet };
}

export async function GET(req: NextRequest) {
    try {
        if (!DIRECTUS_URL) {
            return NextResponse.json({ error: "NEXT_PUBLIC_API_BASE_URL is not set" }, { status: 500 });
        }

        const userId = decodeUserIdFromJwtCookie(req);
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { searchParams } = new URL(req.url);

        const supplierIds = safeCsvIds(searchParams.get("supplier_ids"));
        const supplierScope = (searchParams.get("supplier_scope") || "ALL").toUpperCase();
        const categoryId = safeInt(searchParams.get("category_id"));
        const brandId = safeInt(searchParams.get("brand_id"));

        const catParams = new URLSearchParams();
        catParams.set("limit", "-1");
        catParams.set("fields", "category_id,category_name");
        catParams.set("sort", "category_name");

        const brandParams = new URLSearchParams();
        brandParams.set("limit", "-1");
        brandParams.set("fields", "brand_id,brand_name");
        brandParams.set("sort", "brand_name");

        const unitParams = new URLSearchParams();
        unitParams.set("limit", "-1");
        unitParams.set("fields", "unit_id,unit_name,unit_shortcut,order");
        unitParams.set("sort", "order,unit_name");

        const supplierParams = new URLSearchParams();
        supplierParams.set("limit", "-1");
        supplierParams.set("fields", "id,supplier_name,supplier_shortcut,isActive");
        supplierParams.set("sort", "supplier_name");
        supplierParams.set("filter[isActive][_eq]", "1");

        const [catJson, brandJson, unitJson, supplierJson] = await Promise.all([
            fetchDirectus<{ data: DirectusCategory[] }>(`${DIRECTUS_URL}/items/${CATEGORIES}?${catParams.toString()}`),
            fetchDirectus<{ data: DirectusBrand[] }>(`${DIRECTUS_URL}/items/${BRAND}?${brandParams.toString()}`),
            fetchDirectus<{ data: DirectusUnit[] }>(`${DIRECTUS_URL}/items/${UNITS}?${unitParams.toString()}`),
            fetchDirectus<{ data: DirectusSupplier[] }>(`${DIRECTUS_URL}/items/${SUPPLIERS}?${supplierParams.toString()}`),
        ]);

        let categories: DirectusCategory[] = Array.isArray(catJson.data) ? catJson.data : [];
        let brands: DirectusBrand[] = Array.isArray(brandJson.data) ? brandJson.data : [];
        let units: DirectusUnit[] = Array.isArray(unitJson.data) ? unitJson.data : [];
        const suppliers: DirectusSupplier[] = Array.isArray(supplierJson.data) ? supplierJson.data : [];

        const shouldScopeBySupplier = supplierIds.length > 0 && supplierScope !== "ALL";

        let universeProductIds: number[] | null = null;

        if (shouldScopeBySupplier) {
            const ppsParams = new URLSearchParams();
            ppsParams.set("limit", "-1");
            ppsParams.set("fields", "product_id");
            ppsParams.set("filter[supplier_id][_in]", supplierIds.join(","));

            const ppsJson = await fetchDirectus<{ data: ProductPerSupplierRow[] }>(
                `${DIRECTUS_URL}/items/${PRODUCT_PER_SUPPLIER}?${ppsParams.toString()}`,
            );

            const productIds = uniqById(
                (Array.isArray(ppsJson.data) ? ppsJson.data : [])
                    .map((row) => ({ product_id: row.product_id }))
                    .filter((row) => row.product_id != null),
                "product_id",
            )
                .map((row) => Number(row.product_id))
                .filter((n) => Number.isFinite(n));

            if (productIds.length === 0) {
                return NextResponse.json({
                    data: { categories: [], brands: [], units: [], suppliers },
                });
            }

            universeProductIds = productIds;
        }

        const needsCascade =
            (universeProductIds && universeProductIds.length > 0) || categoryId > 0 || brandId > 0;

        if (needsCascade) {
            const catsSets = await collectSetsFromProducts({
                productIds: universeProductIds ?? undefined,
                brandId: brandId > 0 ? brandId : 0,
                categoryId: 0,
            });

            const brandsSets = await collectSetsFromProducts({
                productIds: universeProductIds ?? undefined,
                categoryId: categoryId > 0 ? categoryId : 0,
                brandId: 0,
            });

            const unitSets = await collectSetsFromProducts({
                productIds: universeProductIds ?? undefined,
                categoryId: categoryId > 0 ? categoryId : 0,
                brandId: brandId > 0 ? brandId : 0,
            });

            categories = categories.filter((c) => catsSets.catSet.has(String(c.category_id)));
            brands = brands.filter((b) => brandsSets.brandSet.has(String(b.brand_id)));
            units = units.filter((u) => unitSets.unitSet.has(String(u.unit_id)));
        }

        return NextResponse.json({
            data: { categories, brands, units, suppliers },
        });
    } catch (error: unknown) {
        return NextResponse.json(
            {
                error: "Unexpected error",
                details: error instanceof Error ? error.message : String(error),
            },
            { status: 500 },
        );
    }
}