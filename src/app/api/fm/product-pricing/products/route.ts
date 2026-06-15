import { NextRequest, NextResponse } from "next/server";

import {
    fetchPaginatedProductGroups,
    fetchProductsByIds,
    resolveSupplierScopedProductIds,
    type ProductRow,
} from "../_productGroups";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

type JwtPayload = {
    sub?: string | number | null;
};

type DirectusErrorShape = {
    message?: string;
    status?: number;
    url?: string;
    body?: string;
};

type ProductsMeta = {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    totalVariants: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
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

function toInt(v: string | null, fallback: number) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
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

function parseProductIdsParam(raw: string | null): number[] {
    if (!raw) return [];
    return Array.from(
        new Set(
            raw
                .split(",")
                .map((s) => Number(s.trim()))
                .filter((n) => Number.isFinite(n) && n > 0),
        ),
    );
}

function parseErrorMessage(message: string): DirectusErrorShape | null {
    try {
        const parsed: unknown = JSON.parse(message);
        return isRecord(parsed) ? (parsed as DirectusErrorShape) : null;
    } catch {
        return null;
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

        const activeOnly = norm(searchParams.get("active_only") || "1") === "1";
        const productIdsParam = parseProductIdsParam(norm(searchParams.get("product_ids")));

        if (productIdsParam.length > 0) {
            const rows = await fetchProductsByIds(productIdsParam, activeOnly);
            return NextResponse.json({ data: rows, meta: { total: rows.length } });
        }

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

        const missingTier = norm(searchParams.get("missing_tier") || "0") === "1";

        const page = Math.max(1, toInt(searchParams.get("page"), 1));
        const groupPageSize = Math.min(200, Math.max(10, toInt(searchParams.get("page_size"), 50)));

        const filters = {
            q,
            categoryIds,
            brandIds,
            unitIds,
            activeOnly,
            missingTier,
        };

        const supplierProductIds = await resolveSupplierScopedProductIds({
            supplierScope,
            supplierIdsRaw,
        });

        if (supplierProductIds && supplierProductIds.length === 0) {
            const emptyMeta: ProductsMeta = {
                page,
                pageSize: groupPageSize,
                total: 0,
                totalPages: 0,
                totalVariants: 0,
            };

            return NextResponse.json({ data: [], meta: emptyMeta });
        }

        const { pageGroups, totalGroups, totalVariants, safePage } = await fetchPaginatedProductGroups({
            page,
            pageSize: groupPageSize,
            supplierProductIds,
            filters,
        });

        const totalPages = totalGroups > 0 ? Math.ceil(totalGroups / groupPageSize) : 0;

        const pageVariants: ProductRow[] = [];
        for (const group of pageGroups) {
            for (const variant of group.variants) {
                pageVariants.push({ ...variant, __group_id: group.group_id });
            }
        }

        const meta: ProductsMeta = {
            page: safePage,
            pageSize: groupPageSize,
            total: totalGroups,
            totalPages,
            totalVariants,
        };

        return NextResponse.json({
            data: pageVariants,
            meta,
        });
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
