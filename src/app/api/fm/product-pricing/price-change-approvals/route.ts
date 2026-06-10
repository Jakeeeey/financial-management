import { NextRequest, NextResponse } from "next/server";

import { parseApprovalSearchQuery } from "../_approvalSearch";
import { toInclusiveDateToEnd } from "../_dateFilters";
import {
    appendBatchSupplierFilter,
    getSupplierProductIds,
    resolveBatchSupplierFilter,
} from "../_supplierFilters";
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
    current_cost?: number | string | null;
    proposed_cost?: number | string | null;
    status?: string | null;
    requested_at?: string | null;
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
    current_cost?: number | null;
    proposed_cost?: number | null;
};

type ApprovalFilters = {
    status: string;
    supplierId: string;
    q: string;
    dateFrom: string;
    dateTo: string;
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

function toMoney(value: unknown): number | null {
    if (value === null || value === undefined || value === "") return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

function parseRequestedAt(value: string | null | undefined): number {
    if (!value) return 0;
    const time = new Date(value).getTime();
    return Number.isFinite(time) ? time : 0;
}

async function appendBatchFilters(params: URLSearchParams, filters: ApprovalFilters) {
    let andIdx = 0;
    const addAnd = (suffix: string, value: string) => {
        params.set(`filter[_and][${andIdx}]${suffix}`, value);
        andIdx += 1;
    };

    if (filters.status) addAnd("[status][_eq]", filters.status);
    if (filters.supplierId) {
        const { headerIdsFromProducts } = await resolveBatchSupplierFilter(filters.supplierId);
        andIdx = appendBatchSupplierFilter(params, andIdx, filters.supplierId, headerIdsFromProducts);
    }
    if (filters.dateFrom) addAnd("[requested_at][_gte]", filters.dateFrom);
    if (filters.dateTo) addAnd("[requested_at][_lte]", toInclusiveDateToEnd(filters.dateTo));
    if (filters.q) {
        const parsed = parseApprovalSearchQuery(filters.q);
        const headerId = parsed.batchHeaderId ?? parsed.numericId;

        if (headerId != null) {
            addAnd("[header_id][_eq]", String(headerId));
        } else if (parsed.textContains) {
            addAnd("[_or][0][reference_no][_contains]", parsed.textContains);
            params.set(`filter[_and][${andIdx - 1}][_or][1][remarks][_contains]`, parsed.textContains);
        }
    }
}

function appendCostFilters(params: URLSearchParams, filters: ApprovalFilters, supplierProductIds?: number[]) {
    let andIdx = 0;
    const addAnd = (suffix: string, value: string) => {
        params.set(`filter[_and][${andIdx}]${suffix}`, value);
        andIdx += 1;
    };

    if (filters.status) addAnd("[status][_eq]", filters.status);
    if (filters.dateFrom) addAnd("[requested_at][_gte]", filters.dateFrom);
    if (filters.dateTo) addAnd("[requested_at][_lte]", toInclusiveDateToEnd(filters.dateTo));

    if (supplierProductIds && supplierProductIds.length > 0) {
        addAnd("[product_id][_in]", supplierProductIds.join(","));
    }

    if (filters.q) {
        const parsed = parseApprovalSearchQuery(filters.q);
        const requestId = parsed.costRequestId ?? parsed.numericId;

        if (requestId != null) {
            addAnd("[request_id][_eq]", String(requestId));
        } else if (parsed.textContains) {
            addAnd("[_or][0][product_id][product_name][_contains]", parsed.textContains);
            params.set(`filter[_and][${andIdx - 1}][_or][1][product_id][product_code][_contains]`, parsed.textContains);
        }
    }
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

async function fetchBatchesPage(
    filters: ApprovalFilters,
    limit: number,
): Promise<{ rows: UnifiedApprovalRow[]; total: number }> {
    const params = new URLSearchParams();
    params.set("limit", String(Math.max(1, limit)));
    params.set("meta", "total_count");
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

    await appendBatchFilters(params, filters);

    const url = `${mustBase()}/items/${HEADERS}?${params.toString()}`;
    const json = await fetchDirectus<DirectusList<BatchHeaderRow>>(url, { headers: directusHeaders() });

    const rows: UnifiedApprovalRow[] = [];

    for (const row of json.data ?? []) {
        const headerId = normalizeHeaderId(row);
        if (!headerId || headerId <= 0) continue;

        const supplierName = supplierNameOf(row.supplier_id);
        const remarks = String(row.remarks ?? "").trim();

        rows.push({
            row_key: `batch:${headerId}`,
            kind: "price_batch",
            record_label: `PCB-${headerId}`,
            title:
                supplierName ||
                (supplierIdOf(row.supplier_id) ? `Supplier #${supplierIdOf(row.supplier_id)}` : "Price batch"),
            subtitle: remarks || String(row.reference_no ?? "").trim() || undefined,
            status: String(row.status ?? "PENDING"),
            requested_at: row.requested_at ?? null,
            batch_id: headerId,
        });
    }

    return {
        rows,
        total: Number(json.meta?.total_count ?? rows.length),
    };
}

async function fetchCostRequestsPage(
    filters: ApprovalFilters,
    limit: number,
    supplierProductIds?: number[],
): Promise<{ rows: UnifiedApprovalRow[]; total: number }> {
    if (filters.supplierId && (!supplierProductIds || supplierProductIds.length === 0)) {
        return { rows: [], total: 0 };
    }

    const params = new URLSearchParams();
    params.set("limit", String(Math.max(1, limit)));
    params.set("meta", "total_count");
    params.set("sort", "-requested_at");
    params.set(
        "fields",
        [
            "request_id",
            "product_id",
            "current_cost",
            "proposed_cost",
            "status",
            "requested_at",
            "product_id.product_id",
            "product_id.product_code",
            "product_id.product_name",
        ].join(","),
    );

    appendCostFilters(params, filters, supplierProductIds);

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
            current_cost: toMoney(row.current_cost),
            proposed_cost: toMoney(row.proposed_cost),
        });
    }

    return {
        rows,
        total: Number(json.meta?.total_count ?? rows.length),
    };
}

async function attachBatchLineCounts(rows: UnifiedApprovalRow[]) {
    await Promise.all(
        rows.map(async (row) => {
            if (row.kind !== "price_batch" || !row.batch_id) return;
            row.line_count = await countLines(row.batch_id);
        }),
    );
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

        const filters: ApprovalFilters = { status, supplierId, q, dateFrom, dateTo };
        const offset = (page - 1) * pageSize;
        const fetchLimit = offset + pageSize;

        const supplierProductIds = supplierId ? await getSupplierProductIds(supplierId) : undefined;

        const [batchPage, costPage] = await Promise.all([
            fetchBatchesPage(filters, fetchLimit),
            fetchCostRequestsPage(filters, fetchLimit, supplierProductIds),
        ]);

        const merged = [...batchPage.rows, ...costPage.rows].sort(
            (a, b) => parseRequestedAt(b.requested_at) - parseRequestedAt(a.requested_at),
        );

        const data = merged.slice(offset, offset + pageSize);
        await attachBatchLineCounts(data);

        const totalCount = batchPage.total + costPage.total;

        return NextResponse.json({
            data,
            meta: { total_count: totalCount },
        });
    } catch (error: unknown) {
        return directusErrorResponse(error);
    }
}
