// src/app/api/fm/product-pricing/printables/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

const PRODUCTS = "products";
const PRODUCT_PER_SUPPLIER = "product_per_supplier";

type ProductRow = {
    product_id: number;
    parent_id: number | null;
    product_code: string | null;
    product_name: string | null;
    product_category: number | string | null;
    product_brand: number | string | null;
    unit_of_measurement: number | string | null;
    isActive: number | string | null;
    price_per_unit?: number | string | null;
    priceA?: number | string | null;
    priceB?: number | string | null;
    priceC?: number | string | null;
    priceD?: number | string | null;
    priceE?: number | string | null;
};

function directusHeaders(): Record<string, string> {
    const token = process.env.DIRECTUS_STATIC_TOKEN || process.env.DIRECTUS_SERVICE_TOKEN || "";
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
}

async function fetchDirectus<T>(url: string): Promise<T> {
    const res = await fetch(url, { cache: "no-store", headers: directusHeaders() });
    if (!res.ok) throw new Error(await res.text());
    return (await res.json()) as T;
}

function pickId(v: unknown): number | null {
    if (v === null || v === undefined) return null;
    const n = Number((v as Record<string, unknown>)?.product_id ?? (v as Record<string, unknown>)?.id ?? v);
    return Number.isFinite(n) && n > 0 ? n : null;
}

export async function GET(req: NextRequest) {
    try {
        if (!DIRECTUS_URL) return NextResponse.json({ error: "API URL not set" }, { status: 500 });
        const { searchParams } = new URL(req.url);

        const page = Math.max(1, Number(searchParams.get("page") || 1));
        const pageSizeRaw = searchParams.get("page_size");
        const pageSize = pageSizeRaw === "-1" ? -1 : Math.max(1, Number(pageSizeRaw || 50));
        const q = searchParams.get("q") || "";
        const categoryIds = searchParams.get("category_ids")?.split(",") || [];
        const brandIds = searchParams.get("brand_ids")?.split(",") || [];
        const unitIds = searchParams.get("unit_ids")?.split(",") || [];
        const supplierIds = searchParams.get("supplier_ids")?.split(",") || [];
        const supplierScope = searchParams.get("supplier_scope") || "ALL";
        const activeOnly = searchParams.get("active_only") === "1";

        const fields = [
            "product_id", "parent_id", "product_code", "product_name",
            "isActive", "product_category", "product_brand", "unit_of_measurement",
            "price_per_unit", "priceA", "priceB", "priceC", "priceD", "priceE", "cost_per_unit"
        ].join(",");

        const params = new URLSearchParams();
        params.set("limit", "-1");
        params.set("fields", fields);

        let andIdx = 0;
        const addAnd = (suffix: string, value: string) => {
            params.set(`filter[_and][${andIdx}]${suffix}`, value);
            andIdx += 1;
        };

        if (activeOnly) addAnd("[isActive][_eq]", "1");
        if (categoryIds.length) addAnd("[product_category][_in]", categoryIds.join(","));
        if (brandIds.length) addAnd("[product_brand][_in]", brandIds.join(","));
        if (unitIds.length) addAnd("[unit_of_measurement][_in]", unitIds.join(","));
        if (q) {
            addAnd("[_or][0][product_name][_contains]", q);
            params.set(`filter[_and][${andIdx - 1}][_or][1][product_code][_contains]`, q);
        }

        // Handle Supplier Filtering
        if (supplierIds.length > 0 || supplierScope === "LINKED_ONLY") {
            const sp = new URLSearchParams();
            sp.set("limit", "-1");
            sp.set("fields", "product_id");
            if (supplierIds.length > 0) {
                sp.set("filter[supplier_id][_in]", supplierIds.join(","));
            }

            const pps = await fetchDirectus<{ data: Record<string, unknown>[] }>(
                `${DIRECTUS_URL}/items/${PRODUCT_PER_SUPPLIER}?${sp.toString()}`
            );
            const pids = pps.data.map(p => pickId(p.product_id)).filter(id => id !== null) as number[];

            if (!pids.length) {
                return NextResponse.json({ data: [], meta: { total_groups: 0, total_pages: 0 } });
            }

            // Step 1: Determine group root IDs for the supplier-linked products
            const productInfoRes = await fetchDirectus<{ data: { product_id: number, parent_id: number | null }[] }>(
                `${DIRECTUS_URL}/items/${PRODUCTS}?filter[product_id][_in]=${pids.join(",")}&fields=product_id,parent_id&limit=-1`
            );

            const groupIds = new Set<number>();
            for (const item of productInfoRes.data) {
                // If this product has a parent (> 0), the root is the parent; otherwise it IS the root
                const gid = pickId(item.parent_id) ?? item.product_id;
                groupIds.add(gid);
            }

            if (groupIds.size > 0) {
                const gidArr = Array.from(groupIds);

                // Step 2: Fetch all children (products whose parent_id is one of our group roots)
                const childrenRes = await fetchDirectus<{ data: { product_id: number }[] }>(
                    `${DIRECTUS_URL}/items/${PRODUCTS}?filter[parent_id][_in]=${gidArr.join(",")}&fields=product_id&limit=-1`
                );
                const childIds = childrenRes.data.map(c => c.product_id).filter(id => Number.isFinite(id) && id > 0);

                // Step 3: Build the full set of product IDs (roots + children)
                const allIds = Array.from(new Set([...gidArr, ...childIds]));
                addAnd("[product_id][_in]", allIds.join(","));
            } else {
                addAnd("[product_id][_in]", pids.join(","));
            }
        }

        const data = await fetchDirectus<{ data: ProductRow[] }>(`${DIRECTUS_URL}/items/${PRODUCTS}?${params.toString()}`);
        const rows = data.data;

        // Grouping
        const groupMap = new Map<number, ProductRow[]>();
        for (const r of rows) {
            const gid = pickId(r.parent_id) ?? pickId(r.product_id);
            if (gid === null) continue;
            if (!groupMap.has(gid)) groupMap.set(gid, []);
            groupMap.get(gid)!.push(r);
        }

        const gids = Array.from(groupMap.keys());
        const totalGroups = gids.length;
        const totalPages = pageSize === -1 ? 1 : Math.ceil(totalGroups / pageSize);

        const pagedGids = pageSize === -1 ? gids : gids.slice((page - 1) * pageSize, page * pageSize);
        const pagedRows: ProductRow[] = [];

        if (pagedGids.length > 0) {
            const variantParams = new URLSearchParams();
            variantParams.set("limit", "-1");
            variantParams.set("fields", fields);
            let andIdx = 0;
            const addVarAnd = (suffix: string, value: string) => {
                variantParams.set(`filter[_and][${andIdx}]${suffix}`, value);
                andIdx += 1;
            };
            if (activeOnly) {
                addVarAnd("[isActive][_eq]", "1");
            }
            addVarAnd("[_or][0][product_id][_in]", pagedGids.join(","));
            variantParams.set(`filter[_and][${andIdx - 1}][_or][1][parent_id][_in]`, pagedGids.join(","));

            const varData = await fetchDirectus<{ data: ProductRow[] }>(`${DIRECTUS_URL}/items/${PRODUCTS}?${variantParams.toString()}`);
            
            const fetchedGroups = new Map<number, ProductRow[]>();
            for (const r of varData.data) {
                const gid = pickId(r.parent_id) ?? pickId(r.product_id);
                if (gid === null) continue;
                if (!pagedGids.includes(gid)) continue;
                if (!fetchedGroups.has(gid)) fetchedGroups.set(gid, []);
                fetchedGroups.get(gid)!.push(r);
            }

            for (const gid of pagedGids) {
                let completeVariants = fetchedGroups.get(gid) ?? [];
                if (unitIds.length > 0) {
                    completeVariants = completeVariants.filter(
                        (v) => v.unit_of_measurement && unitIds.includes(String(v.unit_of_measurement)),
                    );
                }
                pagedRows.push(...completeVariants);
            }
        }

        return NextResponse.json({
            data: pagedRows,
            meta: {
                total_groups: totalGroups,
                total_pages: totalPages,
                page: pageSize === -1 ? 1 : page,
                page_size: pageSize === -1 ? totalGroups : pageSize
            }
        });

    } catch (error: unknown) {
        return NextResponse.json({ error: error instanceof Error ? error.message : "Internal Server Error" }, { status: 500 });
    }
}
