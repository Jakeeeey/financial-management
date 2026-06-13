import { NextRequest, NextResponse } from "next/server";

import { parseApprovalSearchQuery } from "../_approvalSearch";
import { toInclusiveDateToEnd } from "../_dateFilters";
import {
    appendProductIdInFilter,
    getSupplierScopedProductIdsForSuppliers,
    resolveSupplierIds,
} from "../_supplierFilters";
import { enrichPcrRows } from "../_pcrHeaderMeta";
import {
    fetchStreamTopRows,
    MAX_UNIFIED_FETCH,
    mergeUnifiedRows,
} from "../_unifiedApprovalMerge";
import {
    decodeUserIdFromJwtCookie,
    directusErrorResponse,
    directusHeaders,
    fetchDirectus,
    isRecord,
    mustBase,
} from "../price-change-batches/_batch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CCR = "cost_change_requests";
const PCR = "price_change_requests";

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
              unit_of_measurement?:
                  | number
                  | string
                  | {
                        unit_id?: number | string | null;
                        unit_name?: string | null;
                        unit_shortcut?: string | null;
                    }
                  | null;
          }
        | null;
    current_cost?: number | string | null;
    proposed_cost?: number | string | null;
    status?: string | null;
    requested_at?: string | null;
    requested_by?: number | string | null;
    rejected_by?: number | null;
    rejected_at?: string | null;
    reject_reason?: string | null;
};

type DirectusPCRRow = {
    request_id?: number | string | null;
    header_id?:
        | number
        | string
        | {
              header_id?: number | string | null;
              id?: number | string | null;
              remarks?: string | null;
              reference_no?: string | null;
              status?: string | null;
          }
        | null;
    current_price?: number | string | null;
    product_id?:
        | number
        | string
        | {
              product_id?: number | string | null;
              product_code?: string | null;
              product_name?: string | null;
              unit_of_measurement?:
                  | number
                  | string
                  | {
                        unit_id?: number | string | null;
                        unit_name?: string | null;
                        unit_shortcut?: string | null;
                    }
                  | null;
          }
        | null;
    price_type_id?:
        | number
        | string
        | {
              price_type_id?: number | string | null;
              price_type_name?: string | null;
          }
        | null;
    proposed_price?: number | string | null;
    status?: string | null;
    requested_at?: string | null;
    requested_by?: number | string | null;
    batch_header_id?: number | null;
    remarks?: string | null;
    reference_no?: string | null;
};

type UnifiedApprovalRow = {
    row_key: string;
    kind: "price_type" | "list_price";
    record_label: string;
    title: string;
    subtitle?: string;
    status: string;
    requested_at: string | null;
    requested_by?: number | null;
    request_id: number;
    product_id: unknown;
    price_type_id?: unknown;
    proposed_price?: number | null;
    current_cost?: number | null;
    proposed_cost?: number | null;
    reject_reason?: string | null;
    batch_header_id?: number | null;
    remarks?: string | null;
    reference_no?: string | null;
    current_price?: number | null;
};

type ApprovalFilters = {
    status: string;
    supplierIds: string[];
    q: string;
    dateFrom: string;
    dateTo: string;
};

function norm(value: string | null) {
    const text = String(value ?? "").trim();
    if (!text || text === "undefined" || text === "null") return "";
    return text;
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

function appendPriceFilters(params: URLSearchParams, filters: ApprovalFilters, supplierProductIds?: number[]) {
    let andIdx = 0;
    const addAnd = (suffix: string, value: string) => {
        params.set(`filter[_and][${andIdx}]${suffix}`, value);
        andIdx += 1;
    };

    if (filters.status) addAnd("[status][_eq]", filters.status);
    if (filters.dateFrom) addAnd("[requested_at][_gte]", filters.dateFrom);
    if (filters.dateTo) addAnd("[requested_at][_lte]", toInclusiveDateToEnd(filters.dateTo));

    if (supplierProductIds && supplierProductIds.length > 0) {
        andIdx = appendProductIdInFilter(params, andIdx, supplierProductIds);
    }

    if (filters.q) {
        const parsed = parseApprovalSearchQuery(filters.q);
        const requestId = parsed.priceRequestId ?? parsed.numericId;

        if (requestId != null) {
            addAnd("[request_id][_eq]", String(requestId));
        } else if (parsed.textContains) {
            addAnd("[_or][0][product_id][product_name][_contains]", parsed.textContains);
            params.set(`filter[_and][${andIdx - 1}][_or][1][product_id][product_code][_contains]`, parsed.textContains);
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
        andIdx = appendProductIdInFilter(params, andIdx, supplierProductIds);
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

async function fetchPriceRequestsPage(
    filters: ApprovalFilters,
    offset: number,
    limit: number,
    supplierProductIds?: number[],
): Promise<{ rows: UnifiedApprovalRow[]; total: number }> {
    if (filters.supplierIds.length > 0 && (!supplierProductIds || supplierProductIds.length === 0)) {
        return { rows: [], total: 0 };
    }

    const params = new URLSearchParams();
    params.set("limit", String(Math.max(1, limit)));
    params.set("offset", String(Math.max(0, offset)));
    params.set("meta", "total_count");
    params.set("sort", "-requested_at");
    params.set(
        "fields",
        [
            "request_id",
            "product_id",
            "price_type_id",
            "proposed_price",
            "status",
            "requested_by",
            "requested_at",
            "header_id",
            "header_id.header_id",
            "header_id.remarks",
            "header_id.reference_no",
            "header_id.status",
            "current_price",
            "product_id.product_id",
            "product_id.product_code",
            "product_id.product_name",
            "product_id.unit_of_measurement.unit_id",
            "product_id.unit_of_measurement.unit_name",
            "product_id.unit_of_measurement.unit_shortcut",
            "price_type_id.price_type_id",
            "price_type_id.price_type_name",
        ].join(","),
    );

    appendPriceFilters(params, filters, supplierProductIds);

    const url = `${mustBase()}/items/${PCR}?${params.toString()}`;
    const json = await fetchDirectus<DirectusList<DirectusPCRRow>>(url, { headers: directusHeaders() });

    const enrichedRows = await enrichPcrRows(json.data ?? []);
    const rows: UnifiedApprovalRow[] = [];

    for (const row of enrichedRows) {
        const requestId = Number(row.request_id);
        if (!Number.isFinite(requestId) || requestId <= 0) continue;

        const productName = productNameOf(row.product_id);
        const productCode = productCodeOf(row.product_id);
        const requestedBy = Number(row.requested_by);

        rows.push({
            row_key: `price:${requestId}`,
            kind: "price_type",
            record_label: `PCR-${requestId}`,
            title: productName || `Product request #${requestId}`,
            subtitle: productCode || undefined,
            status: String(row.status ?? "PENDING"),
            requested_at: row.requested_at ?? null,
            requested_by: Number.isFinite(requestedBy) ? requestedBy : null,
            request_id: requestId,
            product_id: row.product_id ?? 0,
            price_type_id: row.price_type_id ?? 0,
            proposed_price: toMoney(row.proposed_price),
            batch_header_id: row.batch_header_id ?? null,
            remarks: row.remarks ?? null,
            reference_no: row.reference_no ?? null,
            current_price: toMoney(row.current_price),
        });
    }

    return {
        rows,
        total: Number(json.meta?.total_count ?? rows.length),
    };
}

async function fetchCostRequestsPage(
    filters: ApprovalFilters,
    offset: number,
    limit: number,
    supplierProductIds?: number[],
): Promise<{ rows: UnifiedApprovalRow[]; total: number }> {
    if (filters.supplierIds.length > 0 && (!supplierProductIds || supplierProductIds.length === 0)) {
        return { rows: [], total: 0 };
    }

    const params = new URLSearchParams();
    params.set("limit", String(Math.max(1, limit)));
    params.set("offset", String(Math.max(0, offset)));
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
            "requested_by",
            "requested_at",
            "reject_reason",
            "product_id.product_id",
            "product_id.product_code",
            "product_id.product_name",
            "product_id.unit_of_measurement.unit_id",
            "product_id.unit_of_measurement.unit_name",
            "product_id.unit_of_measurement.unit_shortcut",
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
        const requestedBy = Number(row.requested_by);

        rows.push({
            row_key: `cost:${requestId}`,
            kind: "list_price",
            record_label: `CCR-${requestId}`,
            title: productName || `Product request #${requestId}`,
            subtitle: productCode || undefined,
            status: String(row.status ?? "PENDING"),
            requested_at: row.requested_at ?? null,
            requested_by: Number.isFinite(requestedBy) ? requestedBy : null,
            request_id: requestId,
            product_id: row.product_id ?? 0,
            current_cost: toMoney(row.current_cost),
            proposed_cost: toMoney(row.proposed_cost),
            reject_reason: row.reject_reason ?? null,
        });
    }

    return {
        rows,
        total: Number(json.meta?.total_count ?? rows.length),
    };
}

export async function GET(req: NextRequest) {
    try {
        mustBase();
        const userId = decodeUserIdFromJwtCookie(req);
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const status = norm(searchParams.get("status"));
        const supplierIds = resolveSupplierIds(searchParams);
        const q = norm(searchParams.get("q"));
        const dateFrom = norm(searchParams.get("date_from"));
        const dateTo = norm(searchParams.get("date_to"));
        const page = Math.max(1, Number(searchParams.get("page") ?? 1));
        const pageSize = Math.min(100, Math.max(10, Number(searchParams.get("page_size") ?? 50)));

        const filters: ApprovalFilters = { status, supplierIds, q, dateFrom, dateTo };
        const offset = (page - 1) * pageSize;
        let needed = offset + pageSize;

        const supplierProductIds =
            supplierIds.length > 0
                ? await getSupplierScopedProductIdsForSuppliers(supplierIds)
                : undefined;

        const fetchPriceTop = (fetchNeeded: number) =>
            fetchStreamTopRows(
                (streamOffset, streamLimit) =>
                    fetchPriceRequestsPage(filters, streamOffset, streamLimit, supplierProductIds),
                fetchNeeded,
            );

        const fetchCostTop = (fetchNeeded: number) =>
            fetchStreamTopRows(
                (streamOffset, streamLimit) =>
                    fetchCostRequestsPage(filters, streamOffset, streamLimit, supplierProductIds),
                fetchNeeded,
            );

        let [pricePage, costPage] = await Promise.all([fetchPriceTop(needed), fetchCostTop(needed)]);

        let merged = mergeUnifiedRows(pricePage.rows, costPage.rows);
        let data = merged.slice(offset, offset + pageSize);

        const totalCount = pricePage.total + costPage.total;

        if (
            data.length < pageSize &&
            offset + data.length < totalCount &&
            needed < MAX_UNIFIED_FETCH
        ) {
            needed = Math.min(needed * 2, MAX_UNIFIED_FETCH);
            [pricePage, costPage] = await Promise.all([fetchPriceTop(needed), fetchCostTop(needed)]);
            merged = mergeUnifiedRows(pricePage.rows, costPage.rows);
            data = merged.slice(offset, offset + pageSize);
        }

        return NextResponse.json({
            data,
            meta: { total_count: totalCount },
        });
    } catch (error: unknown) {
        return directusErrorResponse(error);
    }
}
