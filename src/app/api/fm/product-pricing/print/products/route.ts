// src/app/api/product-pricing/print/products/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

const PRODUCTS = "products";
const PRODUCT_PER_SUPPLIER = "product_per_supplier";
const SUPPLIERS = "suppliers";

type JwtPayload = {
    sub?: string | number | null;
};

type DirectusErrorShape = {
    message?: string;
    status?: number;
    url?: string;
    body?: string;
};

type ProductRow = {
    product_id?: number | string | null;
    parent_id?: number | string | { product_id?: number | string | null; id?: number | string | null } | null;
    product_code?: string | null;
    barcode?: string | null;
    product_name?: string | null;
    isActive?: number | string | null;
    product_category?: number | string | null;
    product_brand?: number | string | null;
    unit_of_measurement?: number | string | null;
    priceA?: number | string | null;
    priceB?: number | string | null;
    priceC?: number | string | null;
    priceD?: number | string | null;
    priceE?: number | string | null;
};

type SupplierRow = {
    id?: number | string | null;
    supplier_name?: string | null;
    supplier_shortcut?: string | null;
};

type ProductPerSupplierRow = {
    product_id?: number | string | { product_id?: number | string | null } | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function directusToken() {
    return process.env.DIRECTUS_STATIC_TOKEN || process.env.DIRECTUS_SERVICE_TOKEN || "";
}

function directusHeaders(): Record<string, string> {
    const token = directusToken();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
}

function mergeHeaders(initHeaders?: HeadersInit): HeadersInit {
    return {
        ...directusHeaders(),
        ...(initHeaders instanceof Headers ? Object.fromEntries(initHeaders.entries()) : initHeaders ?? {}),
    };
}

async function fetchDirectusRaw(url: string, init?: RequestInit) {
    const res = await fetch(url, {
        cache: "no-store",
        ...init,
        headers: mergeHeaders(init?.headers),
    });

    const text = await res.text().catch(() => "");
    return { ok: res.ok, status: res.status, text };
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

function norm(v: string | null) {
    const s = (v ?? "").trim();
    if (!s || s === "undefined" || s === "null") return "";
    return s;
}

function splitCsv(v: string): string[] {
    return v
        .split(",")
        .map((x) => x.trim())
        .filter((x) => !!x && x !== "undefined" && x !== "null");
}

function uniqNums(arr: number[]) {
    return Array.from(new Set(arr.filter((n) => Number.isFinite(n) && n > 0)));
}

function chunk<T>(arr: T[], size: number) {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
}

function pickId(v: unknown): number | null {
    if (v === null || v === undefined) return null;

    if (typeof v === "number") {
        return Number.isFinite(v) ? v : null;
    }

    if (typeof v === "string") {
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
    }

    if (isRecord(v)) {
        const candidates: unknown[] = [v.product_id, v.id, isRecord(v.data) ? v.data.product_id : undefined, isRecord(v.data) ? v.data.id : undefined];

        for (const candidate of candidates) {
            const n = Number(candidate);
            if (Number.isFinite(n) && n > 0) return n;
        }
    }

    return null;
}

function normalizeProductRow(row: ProductRow): ProductRow {
    const parentId = pickId(row.parent_id);
    return { ...row, parent_id: parentId ?? null };
}

function parseErrorMessage(message: string): DirectusErrorShape | null {
    try {
        const parsed: unknown = JSON.parse(message);
        return isRecord(parsed) ? (parsed as DirectusErrorShape) : null;
    } catch {
        return null;
    }
}

async function resolveSupplierId(input: string): Promise<string> {
    const asNum = Number(input);
    if (Number.isFinite(asNum) && asNum > 0) return String(asNum);

    const sp = new URLSearchParams();
    sp.set("limit", "5");
    sp.set("fields", "id,supplier_name,supplier_shortcut");
    sp.set("filter[_or][0][supplier_shortcut][_eq]", input);
    sp.set("filter[_or][1][supplier_name][_contains]", input);

    const url = `${DIRECTUS_URL}/items/${SUPPLIERS}?${sp.toString()}`;
    const { ok, status, text } = await fetchDirectusRaw(url);

    if (!ok) {
        throw new Error(
            JSON.stringify({
                message: "Directus request failed (suppliers resolve)",
                status,
                url,
                body: text,
            }),
        );
    }

    const json = JSON.parse(text) as { data?: SupplierRow[] };
    const first = (json.data ?? [])[0];
    const id = pickId(first?.id);
    if (!id) return "";
    return String(id);
}

async function fetchSupplierProductIds(supplierIdRaw: string) {
    const supplierId = await resolveSupplierId(supplierIdRaw);
    if (!supplierId) return [];

    const sp = new URLSearchParams();
    sp.set("limit", "-1");
    sp.set("fields", "product_id,product_id.product_id");
    sp.set("filter[supplier_id][_eq]", supplierId);

    const url = `${DIRECTUS_URL}/items/${PRODUCT_PER_SUPPLIER}?${sp.toString()}`;
    const { ok, status, text } = await fetchDirectusRaw(url);

    if (!ok) {
        throw new Error(
            JSON.stringify({
                message: "Directus request failed (product_per_supplier)",
                status,
                url,
                body: text,
            }),
        );
    }

    const json = JSON.parse(text) as { data?: ProductPerSupplierRow[] };

    const ids = (json.data ?? [])
        .map((row) => {
            const direct = pickId(row.product_id);
            if (direct) return direct;

            const nested =
                isRecord(row.product_id) && "product_id" in row.product_id
                    ? pickId(row.product_id.product_id)
                    : null;

            return nested ?? null;
        })
        .filter((n): n is number => n !== null && Number.isFinite(n) && n > 0);

    return uniqNums(ids);
}

function applyCommonFilters(args: {
    params: URLSearchParams;
    q: string;
    categoryIds: string[];
    brandIds: string[];
    unitIds: string[];
    activeOnly: boolean;
    missingTier: boolean;
    productIdsIn?: number[];
}) {
    const { params, q, categoryIds, brandIds, unitIds, activeOnly, missingTier, productIdsIn } = args;

    let andIdx = 0;
    const addAnd = (suffix: string, value: string) => {
        params.set(`filter[_and][${andIdx}]${suffix}`, value);
        andIdx += 1;
    };

    if (activeOnly) addAnd("[isActive][_eq]", "1");
    if (categoryIds.length > 0) addAnd("[product_category][_in]", categoryIds.join(","));
    if (brandIds.length > 0) addAnd("[product_brand][_in]", brandIds.join(","));
    if (unitIds.length > 0) addAnd("[unit_of_measurement][_in]", unitIds.join(","));

    if (q) {
        addAnd("[_or][0][product_name][_contains]", q);
        params.set(`filter[_and][${andIdx - 1}][_or][1][product_code][_contains]`, q);
        params.set(`filter[_and][${andIdx - 1}][_or][2][barcode][_contains]`, q);
    }

    if (missingTier) {
        addAnd("[_or][0][priceA][_null]", "true");
        params.set(`filter[_and][${andIdx - 1}][_or][1][priceB][_null]`, "true");
        params.set(`filter[_and][${andIdx - 1}][_or][2][priceC][_null]`, "true");
        params.set(`filter[_and][${andIdx - 1}][_or][3][priceD][_null]`, "true");
        params.set(`filter[_and][${andIdx - 1}][_or][4][priceE][_null]`, "true");
    }

    if (productIdsIn && productIdsIn.length > 0) {
        addAnd("[product_id][_in]", productIdsIn.join(","));
    }
}

export async function GET(req: NextRequest) {
    try {
        if (!DIRECTUS_URL) {
            return NextResponse.json({ error: "NEXT_PUBLIC_API_BASE_URL is not set" }, { status: 500 });
        }

        const userId = decodeUserIdFromJwtCookie(req);
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { searchParams } = new URL(req.url);

        const q = norm(searchParams.get("q"));

        const categoryIds = (() => {
            const multi = norm(searchParams.get("category_ids"));
            if (multi) return splitCsv(multi);
            const single = norm(searchParams.get("category_id"));
            return single ? [single] : [];
        })();

        const brandIds = (() => {
            const multi = norm(searchParams.get("brand_ids"));
            if (multi) return splitCsv(multi);
            const single = norm(searchParams.get("brand_id"));
            return single ? [single] : [];
        })();

        const unitIds = (() => {
            const multi = norm(searchParams.get("unit_ids"));
            if (multi) return splitCsv(multi);
            const single = norm(searchParams.get("unit_id"));
            return single ? [single] : [];
        })();

        const supplierScope = (norm(searchParams.get("supplier_scope")) || "ALL") as "ALL" | "LINKED_ONLY";

        const supplierIdsRaw = (() => {
            const multi = norm(searchParams.get("supplier_ids"));
            if (multi) return splitCsv(multi);
            const single = norm(searchParams.get("supplier_id"));
            return single ? [single] : [];
        })();

        const activeOnly = norm(searchParams.get("active_only") || "1") === "1";
        const missingTier = norm(searchParams.get("missing_tier") || "0") === "1";

        const fields = [
            "product_id",
            "parent_id",
            "product_code",
            "barcode",
            "product_name",
            "isActive",
            "product_category",
            "product_brand",
            "unit_of_measurement",
            "priceA",
            "priceB",
            "priceC",
            "priceD",
            "priceE",
        ].join(",");

        if (supplierScope !== "LINKED_ONLY" || supplierIdsRaw.length === 0) {
            const params = new URLSearchParams();
            params.set("limit", "-1");
            params.set("fields", fields);
            params.set("sort", "product_name");

            applyCommonFilters({ params, q, categoryIds, brandIds, unitIds, activeOnly, missingTier });

            const directusUrl = `${DIRECTUS_URL}/items/${PRODUCTS}?${params.toString()}`;
            const { ok, status, text } = await fetchDirectusRaw(directusUrl);

            if (!ok) {
                return NextResponse.json(
                    {
                        error: "Directus request failed",
                        directus_status: status,
                        directus_url: directusUrl,
                        directus_body: text,
                    },
                    { status: 500 },
                );
            }

            const json = JSON.parse(text) as { data?: ProductRow[] };
            return NextResponse.json({ data: (json.data ?? []).map(normalizeProductRow) });
        }

        const allSupplierProductIds: number[] = [];
        for (const supplierRaw of supplierIdsRaw) {
            const ids = await fetchSupplierProductIds(supplierRaw);
            allSupplierProductIds.push(...ids);
        }

        const supplierProductIds = uniqNums(allSupplierProductIds);
        if (supplierProductIds.length === 0) {
            return NextResponse.json({ data: [] });
        }

        const idsChunks = chunk(supplierProductIds, 200);

        const arrays = await Promise.all(
            idsChunks.map(async (ids) => {
                const params = new URLSearchParams();
                params.set("limit", "-1");
                params.set("fields", fields);
                params.set("sort", "product_name");

                applyCommonFilters({
                    params,
                    q,
                    categoryIds,
                    brandIds,
                    unitIds,
                    activeOnly,
                    missingTier,
                    productIdsIn: ids,
                });

                const directusUrl = `${DIRECTUS_URL}/items/${PRODUCTS}?${params.toString()}`;
                const { ok, status, text } = await fetchDirectusRaw(directusUrl);

                if (!ok) {
                    throw new Error(
                        JSON.stringify({
                            message: "Directus request failed (products chunk)",
                            status,
                            url: directusUrl,
                            body: text,
                        }),
                    );
                }

                const json = JSON.parse(text) as { data?: ProductRow[] };
                return (json.data ?? []).map(normalizeProductRow);
            }),
        );

        const byId = new Map<number, ProductRow>();
        for (const arr of arrays) {
            for (const row of arr) {
                const id = pickId(row.product_id);
                if (id) byId.set(id, row);
            }
        }

        const allRows = Array.from(byId.values());
        allRows.sort((a, b) => String(a.product_name ?? "").localeCompare(String(b.product_name ?? "")));

        return NextResponse.json({ data: allRows });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        const parsed = parseErrorMessage(message);

        if (parsed) {
            return NextResponse.json(
                {
                    error: parsed.message ?? "Directus request failed",
                    directus_status: parsed.status,
                    directus_url: parsed.url,
                    directus_body: parsed.body,
                },
                { status: 500 },
            );
        }

        return NextResponse.json({ error: "Unexpected error", details: message }, { status: 500 });
    }
}