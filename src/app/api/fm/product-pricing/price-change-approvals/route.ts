import { NextRequest, NextResponse } from "next/server";

import {
    BatchHeaderRow,
    DETAILS,
    HEADERS,
    decodeUserIdFromJwtCookie,
    directusErrorResponse,
    directusHeaders,
    fetchDirectus,
    isRecord,
    mustBase,
    normalizeHeaderId,
    pickId,
} from "../price-change-batches/_batch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CCR = "cost_change_requests";
const PRODUCT_PER_SUPPLIER = "product_per_supplier";

type DirectusList<T> = { data?: T[]; meta?: { total_count?: number } | null };

type DirectusCCRRow = {
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
    status?: string | null;
    requested_at?: string | null;
};

type DirectusSupplierProductRow = {
    product_id?: number | string | { product_id?: number | string | null } | null;
};

type UnifiedApprovalRow = {
    row_key: string;
    kind: "price_batch" | "list_price";
    record_label: string;
    title: string;
    subtitle?: string;
    status: string;
    requested_at: string | null;
    line_count?: number;
    batch_id?: number;
    request_id?: number;
};

function norm(value: string | null) {
    const text = String(value ?? "").trim();
    if (!text || text === "undefined" || text === "null") return "";
    return text;
}

function supplierIdOf(value: unknown): number | null {
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (typeof value === "string") {
        const n = Number(value);
        return Number.isFinite(n) ? n : null;
    }
    if (isRecord(value)) return pickId(value.id);
    return null;
}

function supplierNameOf(value: unknown): string {
    if (!isRecord(value)) return "";
    const shortcut = String(value.supplier_shortcut ?? "").trim();
    const name = String(value.supplier_name ?? "").trim();
    return shortcut && name ? `${shortcut} - ${name}` : name || shortcut;
}

function productNameOf(value: unknown): string {
    if (!isRecord(value)) return "";
    return String(value.product_name ?? "").trim();
}

function productCodeOf(value: unknown): string {
    if (!isRecord(value)) return "";
    return String(value.product_code ?? "").trim();
}

function parseRequestedAt(value: string | null | undefined): number {
    if (!value) return 0;
    const time = new Date(value).getTime();
    return Number.isFinite(time) ? time : 0;
}

async function countLines(headerId: number) {
    const params = new URLSearchParams();
    params.set("limit", "1");
    params.set("meta", "total_count");
    params.set("fields", "request_id");
    params.set("filter[header_id][_eq]", String(headerId));

    const url = `${mustBase()}/items/${DETAILS}?${params.toString()}`;
    const json = await fetchDirectus<DirectusList<unknown>>(url, { headers: directusHeaders() });
    return Number(json.meta?.total_count ?? 0);
}

async function getSupplierProductIds(supplierId: string): Promise<number[]> {
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

async function fetchAllBatches(filters: {
    status: string;
    supplierId: string;
    q: string;
    dateFrom: string;
    dateTo: string;
}): Promise<UnifiedApprovalRow[]> {
    const params = new URLSearchParams();
    params.set("limit", "-1");
    params.set("sort", "-requested_at");
    params.set(
        "fields",
        [
            "header_id",
            "supplier_id",
            "supplier_id.id",
            "supplier_id.supplier_name",
            "supplier_id.supplier_shortcut",
            "reference_no",
            "remarks",
            "status",
            "requested_at",
        ].join(","),
    );

    let andIdx = 0;
    const addAnd = (suffix: string, value: string) => {
        params.set(`filter[_and][${andIdx}]${suffix}`, value);
        andIdx += 1;
    };

    if (filters.status) addAnd("[status][_eq]", filters.status);
    if (filters.supplierId) addAnd("[supplier_id][_eq]", filters.supplierId);
    if (filters.dateFrom) addAnd("[requested_at][_gte]", filters.dateFrom);
    if (filters.dateTo) addAnd("[requested_at][_lte]", filters.dateTo);
    if (filters.q) {
        addAnd("[_or][0][reference_no][_contains]", filters.q);
        params.set(`filter[_and][${andIdx - 1}][_or][1][remarks][_contains]`, filters.q);
        if (Number.isFinite(Number(filters.q))) {
            params.set(`filter[_and][${andIdx - 1}][_or][2][header_id][_eq]`, filters.q);
        }
    }

    const url = `${mustBase()}/items/${HEADERS}?${params.toString()}`;
    const json = await fetchDirectus<DirectusList<BatchHeaderRow>>(url, { headers: directusHeaders() });

    const rows = await Promise.all(
        (json.data ?? []).map(async (row) => {
            const headerId = normalizeHeaderId(row);
            const lineCount = headerId ? await countLines(headerId) : 0;
            const supplierName = supplierNameOf(row.supplier_id);
            const remarks = String(row.remarks ?? "").trim();

            return {
                row_key: `batch:${headerId}`,
                kind: "price_batch" as const,
                record_label: `PCB-${headerId}`,
                title: supplierName || (supplierIdOf(row.supplier_id) ? `Supplier #${supplierIdOf(row.supplier_id)}` : "Price batch"),
                subtitle: remarks || String(row.reference_no ?? "").trim() || undefined,
                status: String(row.status ?? "PENDING"),
                requested_at: row.requested_at ?? null,
                line_count: lineCount,
                batch_id: headerId,
            };
        }),
    );

    return rows.filter((row) => row.batch_id && row.batch_id > 0);
}

async function fetchAllCostRequests(filters: {
    status: string;
    supplierId: string;
    q: string;
    dateFrom: string;
    dateTo: string;
}): Promise<UnifiedApprovalRow[]> {
    if (filters.supplierId) {
        const supplierProductIds = await getSupplierProductIds(filters.supplierId);
        if (supplierProductIds.length === 0) return [];
    }

    const params = new URLSearchParams();
    params.set("limit", "-1");
    params.set("sort", "-requested_at");
    params.set(
        "fields",
        [
            "request_id",
            "product_id",
            "status",
            "requested_at",
            "product_id.product_id",
            "product_id.product_code",
            "product_id.product_name",
        ].join(","),
    );

    let andIdx = 0;
    const addAnd = (suffix: string, value: string) => {
        params.set(`filter[_and][${andIdx}]${suffix}`, value);
        andIdx += 1;
    };

    if (filters.status) addAnd("[status][_eq]", filters.status);
    if (filters.dateFrom) addAnd("[requested_at][_gte]", filters.dateFrom);
    if (filters.dateTo) addAnd("[requested_at][_lte]", filters.dateTo);

    if (filters.supplierId) {
        const supplierProductIds = await getSupplierProductIds(filters.supplierId);
        addAnd("[product_id][_in]", supplierProductIds.join(","));
    }

    if (filters.q) {
        addAnd("[_or][0][product_id][product_name][_contains]", filters.q);
        params.set(`filter[_and][${andIdx - 1}][_or][1][product_id][product_code][_contains]`, filters.q);
        params.set(`filter[_and][${andIdx - 1}][_or][2][request_id][_eq]`, filters.q);
    }

    const url = `${mustBase()}/items/${CCR}?${params.toString()}`;
    const json = await fetchDirectus<DirectusList<DirectusCCRRow>>(url, { headers: directusHeaders() });

    const rows: UnifiedApprovalRow[] = [];

    for (const row of json.data ?? []) {
        const requestId = Number(row.request_id);
        if (!Number.isFinite(requestId) || requestId <= 0) continue;

        const productName = productNameOf(row.product_id);
        const productCode = productCodeOf(row.product_id);

        rows.push({
            row_key: `cost:${requestId}`,
            kind: "list_price",
            record_label: `CCR-${requestId}`,
            title: productName || `Product request #${requestId}`,
            subtitle: productCode || undefined,
            status: String(row.status ?? "PENDING"),
            requested_at: row.requested_at ?? null,
            request_id: requestId,
        });
    }

    return rows;
}

export async function GET(req: NextRequest) {
    try {
        mustBase();
        const userId = decodeUserIdFromJwtCookie(req);
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const status = norm(searchParams.get("status"));
        const supplierId = norm(searchParams.get("supplier_id"));
        const q = norm(searchParams.get("q"));
        const dateFrom = norm(searchParams.get("date_from"));
        const dateTo = norm(searchParams.get("date_to"));
        const page = Math.max(1, Number(searchParams.get("page") ?? 1));
        const pageSize = Math.min(100, Math.max(10, Number(searchParams.get("page_size") ?? 50)));

        const filters = { status, supplierId, q, dateFrom, dateTo };

        const [batchRows, costRows] = await Promise.all([
            fetchAllBatches(filters),
            fetchAllCostRequests(filters),
        ]);

        const merged = [...batchRows, ...costRows].sort(
            (a, b) => parseRequestedAt(b.requested_at) - parseRequestedAt(a.requested_at),
        );

        const totalCount = merged.length;
        const start = (page - 1) * pageSize;
        const data = merged.slice(start, start + pageSize);

        return NextResponse.json({
            data,
            meta: { total_count: totalCount },
        });
    } catch (error: unknown) {
        return directusErrorResponse(error);
    }
}
