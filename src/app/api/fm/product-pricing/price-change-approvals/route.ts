import { NextRequest, NextResponse } from "next/server";

import { parseApprovalSearchQuery, shouldFetchCostStreamInUnifiedSearch, shouldFetchPriceStreamInUnifiedSearch } from "../_approvalSearch";
import { toInclusiveDateToEnd } from "../_dateFilters";
import {
    appendProductIdInFilter,
    getBatchHeaderIdsForProducts,
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
    BatchDetailRow,
    BatchHeaderRow,
    DETAILS,
    HEADERS,
    getSupplierNameListsByProductId,
    isRecord,
    mustBase,
    normalizeHeaderId,
    normalizeProductId,
    pickId,
} from "../price-change-batches/_batch";
import {
    COST_HEADERS,
    COST_DETAILS,
    CostDetailRow,
    CostHeaderRow,
    normalizeCostHeaderId,
    normalizeCostHeaderIdOfDetail,
    normalizeCostProductId,
} from "../cost-change-batches/_batch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CCR = "cost_change_requests";
const PCR = "price_change_requests";

type DirectusList<T> = { data?: T[]; meta?: { total_count?: number } | null };

type DirectusCCRRow = {
    request_id?: number | string | null;
    header_id?: number | string | CostHeaderRow | null;
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
    kind: "price_batch" | "cost_batch" | "price_type" | "list_price";
    record_label: string;
    title: string;
    subtitle?: string;
    status: string;
    requested_at: string | null;
    requested_by?: number | null;
    requested_by_name?: string | null;
    request_id?: number;
    product_id?: unknown;
    price_type_id?: unknown;
    proposed_price?: number | null;
    current_cost?: number | null;
    proposed_cost?: number | null;
    reject_reason?: string | null;
    batch_header_id?: number | null;
    batch_id?: number;
    line_count?: number;
    total_products?: number;
    proposed_min?: number | null;
    proposed_max?: number | null;
    remarks?: string | null;
    reference_no?: string | null;
    current_price?: number | null;
    supplier_id?: number | null;
    supplier_name?: string | null;
    supplier_names?: string[];
};

type DirectusUserRow = {
    user_id?: number | string | null;
    user_fname?: string | null;
    user_mname?: string | null;
    user_lname?: string | null;
    user_email?: string | null;
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

function isCostHeaderAccessError(error: unknown): boolean {
    if (!(error instanceof Error) || !error.message) return false;

    try {
        const parsed: unknown = JSON.parse(error.message);
        if (!isRecord(parsed)) return false;

        const status = Number(parsed.status);
        const url = String(parsed.url ?? "");
        const body = String(parsed.body ?? "");
        const text = `${url} ${body}`.toLowerCase();

        return (
            [400, 401, 403, 404].includes(status) &&
            (text.includes(COST_DETAILS) || text.includes("header_id") || text.includes("price_change_headers"))
        );
    } catch {
        return false;
    }
}

function joinName(parts: Array<string | null | undefined>): string {
    return parts.map((part) => String(part ?? "").trim()).filter(Boolean).join(" ");
}

async function fetchUserNamesById(userIds: Array<number | null | undefined>): Promise<Map<number, string>> {
    const ids = Array.from(
        new Set(
            userIds
                .map((value) => Number(value))
                .filter((value) => Number.isFinite(value) && value > 0),
        ),
    );
    const userNames = new Map<number, string>();
    if (ids.length === 0) return userNames;

    try {
        for (let i = 0; i < ids.length; i += 100) {
            const chunk = ids.slice(i, i + 100);
            const params = new URLSearchParams();
            params.set("limit", String(Math.max(100, chunk.length)));
            params.set("fields", "user_id,user_fname,user_mname,user_lname,user_email");
            params.set("filter[user_id][_in]", chunk.join(","));

            const url = `${mustBase()}/items/user?${params.toString()}`;
            const json = await fetchDirectus<DirectusList<DirectusUserRow>>(url, { headers: directusHeaders() });

            for (const user of json.data ?? []) {
                const id = Number(user.user_id);
                if (!Number.isFinite(id) || id <= 0) continue;

                const displayName =
                    joinName([user.user_fname, user.user_mname, user.user_lname]) ||
                    String(user.user_email ?? "").trim() ||
                    `User #${id}`;
                userNames.set(id, displayName);
            }
        }
    } catch {
        return userNames;
    }

    return userNames;
}

async function addSuppliersToRows(rows: UnifiedApprovalRow[]): Promise<UnifiedApprovalRow[]> {
    const productIds: number[] = [];

    for (const row of rows) {
        if (row.kind === "price_type" || row.kind === "list_price") {
            const pid = pickProductId(row.product_id);
            if (pid) productIds.push(pid);
        }
    }

    const supplierByProductId = await getSupplierNameListsByProductId(productIds);

    return rows.map((row) => {
        if (row.kind === "price_batch" || row.kind === "cost_batch") {
            return row;
        }

        const pid = pickProductId(row.product_id);
        const supplierNames = pid ? supplierByProductId.get(pid) : undefined;

        if (!supplierNames || supplierNames.length === 0) {
            return { ...row, supplier_id: null, supplier_name: null, supplier_names: [] };
        }

        return {
            ...row,
            supplier_name: compactSupplierDisplayName(supplierNames),
            supplier_names: supplierNames,
        };
    });
}

async function addRequestedByNames(rows: UnifiedApprovalRow[]): Promise<UnifiedApprovalRow[]> {
    const namesById = await fetchUserNamesById(rows.map((row) => row.requested_by));

    return rows.map((row) => {
        const requestedBy = Number(row.requested_by);
        return {
            ...row,
            requested_by_name:
                Number.isFinite(requestedBy) && requestedBy > 0
                    ? namesById.get(requestedBy) ?? `User #${requestedBy}`
                    : null,
        };
    });
}

function supplierNameOf(value: unknown): string {
    if (!isRecord(value)) return "";
    const shortcut = String(value.supplier_shortcut ?? "").trim();
    const name = String(value.supplier_name ?? "").trim();
    return shortcut && name ? `${shortcut} - ${name}` : name || shortcut;
}

function supplierIdOf(value: unknown): number | null {
    if (!isRecord(value)) return null;
    return pickId(value.id) ?? null;
}

function pickProductId(value: unknown): number | null {
    if (isRecord(value)) return pickId(value.product_id);
    return pickId(value);
}

type SupplierInfo = { supplier_id: number; supplier_name: string };

async function fetchSupplierByProductIds(productIds: number[]): Promise<Map<number, SupplierInfo[]>> {
    const map = new Map<number, SupplierInfo[]>();
    const uniqueIds = Array.from(new Set(productIds.filter((id) => Number.isFinite(id) && id > 0)));
    if (uniqueIds.length === 0) return map;

    for (let i = 0; i < uniqueIds.length; i += 200) {
        const chunk = uniqueIds.slice(i, i + 200);
        const params = new URLSearchParams();
        params.set("limit", "-1");
        params.set("fields", "product_id,supplier_id,supplier_id.id,supplier_id.supplier_name,supplier_id.supplier_shortcut");
        params.set("filter[product_id][_in]", chunk.join(","));

        const url = `${mustBase()}/items/product_per_supplier?${params.toString()}`;
        const json = await fetchDirectus<DirectusList<Record<string, unknown>>>(url, { headers: directusHeaders() });

        for (const row of json.data ?? []) {
            const pid = pickId(row.product_id);
            if (!pid) continue;

            const supplier = row.supplier_id;
            const sid = isRecord(supplier) ? pickId(supplier.id) : null;
            if (!sid) continue;

            const sname = supplierNameOf(supplier);
            const existing = map.get(pid) ?? [];
            existing.push({ supplier_id: sid, supplier_name: sname || `Supplier #${sid}` });
            map.set(pid, existing);
        }
    }

    return map;
}

function uniqueSupplierNames(labels: string[]): string[] {
    return Array.from(new Set(labels.map((label) => String(label ?? "").trim()).filter(Boolean)));
}

function uniqueSupplierNamesFromInfos(suppliers: SupplierInfo[]): string[] {
    return uniqueSupplierNames(suppliers.map((supplier) => supplier.supplier_name));
}

function resolveSupplierName(suppliers: SupplierInfo[]): string {
    if (suppliers.length === 0) return "-";
    const unique = Array.from(new Set(suppliers.map((s) => s.supplier_name)));
    return unique.length === 1 ? unique[0] : "Multiple suppliers";
}

function compactSupplierDisplayName(labels: string[]): string {
    if (labels.length === 0) return "-";
    return labels.length === 1 ? labels[0] : "Multiple suppliers";
}

function headerIdOfDetail(row: BatchDetailRow): number {
    const raw = row.header_id;
    if (isRecord(raw)) return pickId(raw.header_id ?? raw.id) ?? 0;
    return pickId(raw) ?? 0;
}

type BatchLineSummary = {
    lineCount: number;
    totalProducts: number;
    proposedMin: number | null;
    proposedMax: number | null;
    productIds: number[];
};

async function summarizeBatchLines(headerIds: number[]): Promise<Map<number, BatchLineSummary>> {
    const summaries = new Map<number, {
        lineCount: number;
        productIds: Set<number>;
        proposedValues: number[];
    }>();

    const ids = Array.from(new Set(headerIds.filter((id) => Number.isFinite(id) && id > 0)));
    if (ids.length === 0) return new Map();

    for (let i = 0; i < ids.length; i += 100) {
        const chunk = ids.slice(i, i + 100);
        const params = new URLSearchParams();
        params.set("limit", "-1");
        params.set("fields", "header_id,product_id,proposed_price");
        params.set("filter[header_id][_in]", chunk.join(","));

        const url = `${mustBase()}/items/${DETAILS}?${params.toString()}`;
        const json = await fetchDirectus<DirectusList<BatchDetailRow>>(url, { headers: directusHeaders() });

        for (const line of json.data ?? []) {
            const headerId = headerIdOfDetail(line);
            if (!headerId) continue;

            const summary = summaries.get(headerId) ?? {
                lineCount: 0,
                productIds: new Set<number>(),
                proposedValues: [],
            };

            summary.lineCount += 1;

            const productId = normalizeProductId(line);
            if (productId > 0) summary.productIds.add(productId);

            const proposed = toMoney(line.proposed_price);
            if (proposed !== null) summary.proposedValues.push(proposed);

            summaries.set(headerId, summary);
        }
    }

    const normalized = new Map<number, BatchLineSummary>();
    for (const [headerId, summary] of summaries) {
        normalized.set(headerId, {
            lineCount: summary.lineCount,
            totalProducts: summary.productIds.size,
            proposedMin: summary.proposedValues.length ? Math.min(...summary.proposedValues) : null,
            proposedMax: summary.proposedValues.length ? Math.max(...summary.proposedValues) : null,
            productIds: Array.from(summary.productIds),
        });
    }

    return normalized;
}

async function summarizeCostBatchLines(headerIds: number[]): Promise<Map<number, BatchLineSummary>> {
    const summaries = new Map<number, {
        lineCount: number;
        productIds: Set<number>;
        proposedValues: number[];
    }>();

    const ids = Array.from(new Set(headerIds.filter((id) => Number.isFinite(id) && id > 0)));
    if (ids.length === 0) return new Map();

    for (let i = 0; i < ids.length; i += 100) {
        const chunk = ids.slice(i, i + 100);
        const params = new URLSearchParams();
        params.set("limit", "-1");
        params.set("fields", "header_id,product_id,proposed_cost");
        params.set("filter[header_id][_in]", chunk.join(","));

        const url = `${mustBase()}/items/${COST_DETAILS}?${params.toString()}`;
        const json = await fetchDirectus<DirectusList<CostDetailRow>>(url, { headers: directusHeaders() });

        for (const line of json.data ?? []) {
            const headerId = normalizeCostHeaderIdOfDetail(line);
            if (!headerId) continue;

            const summary = summaries.get(headerId) ?? {
                lineCount: 0,
                productIds: new Set<number>(),
                proposedValues: [],
            };

            summary.lineCount += 1;

            const productId = normalizeCostProductId(line);
            if (productId > 0) summary.productIds.add(productId);

            const proposed = toMoney(line.proposed_cost);
            if (proposed !== null) summary.proposedValues.push(proposed);

            summaries.set(headerId, summary);
        }
    }

    const normalized = new Map<number, BatchLineSummary>();
    for (const [headerId, summary] of summaries) {
        normalized.set(headerId, {
            lineCount: summary.lineCount,
            totalProducts: summary.productIds.size,
            proposedMin: summary.proposedValues.length ? Math.min(...summary.proposedValues) : null,
            proposedMax: summary.proposedValues.length ? Math.max(...summary.proposedValues) : null,
            productIds: Array.from(summary.productIds),
        });
    }

    return normalized;
}

async function getBatchHeaderIdsForProductSearch(text: string): Promise<number[]> {
    const q = String(text ?? "").trim();
    if (!q) return [];

    const ids: number[] = [];
    let offset = 0;
    const limit = 500;

    while (true) {
        const params = new URLSearchParams();
        params.set("limit", String(limit));
        params.set("offset", String(offset));
        params.set("fields", "header_id");
        params.set("filter[_or][0][product_id][product_name][_contains]", q);
        params.set("filter[_or][1][product_id][product_code][_contains]", q);

        const url = `${mustBase()}/items/${DETAILS}?${params.toString()}`;
        const json = await fetchDirectus<DirectusList<BatchDetailRow>>(url, { headers: directusHeaders() });
        const rows = json.data ?? [];

        for (const row of rows) {
            const headerId = headerIdOfDetail(row);
            if (headerId > 0) ids.push(headerId);
        }

        if (rows.length < limit) break;
        offset += rows.length;
    }

    return Array.from(new Set(ids));
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

    return andIdx;
}

async function getCostHeaderIdsForProductSearch(text: string): Promise<number[]> {
    const q = String(text ?? "").trim();
    if (!q) return [];

    const ids: number[] = [];
    let offset = 0;
    const limit = 500;

    while (true) {
        const params = new URLSearchParams();
        params.set("limit", String(limit));
        params.set("offset", String(offset));
        params.set("fields", "header_id");
        params.set("filter[_or][0][product_id][product_name][_contains]", q);
        params.set("filter[_or][1][product_id][product_code][_contains]", q);

        const url = `${mustBase()}/items/${COST_DETAILS}?${params.toString()}`;
        const json = await fetchDirectus<DirectusList<CostDetailRow>>(url, { headers: directusHeaders() });
        const rows = json.data ?? [];

        for (const row of rows) {
            const headerId = normalizeCostHeaderIdOfDetail(row);
            if (headerId > 0) ids.push(headerId);
        }

        if (rows.length < limit) break;
        offset += rows.length;
    }

    return Array.from(new Set(ids));
}

async function getCostHeaderIdsForProducts(productIds: number[]): Promise<number[]> {
    const ids = Array.from(new Set(productIds.filter((id) => Number.isFinite(id) && id > 0)));
    if (ids.length === 0) return [];

    const headerIds: number[] = [];

    for (let i = 0; i < ids.length; i += 200) {
        const chunk = ids.slice(i, i + 200);
        const params = new URLSearchParams();
        params.set("limit", "-1");
        params.set("fields", "header_id");
        params.set("filter[product_id][_in]", chunk.join(","));

        const url = `${mustBase()}/items/${COST_DETAILS}?${params.toString()}`;
        const json = await fetchDirectus<DirectusList<CostDetailRow>>(url, { headers: directusHeaders() });

        for (const row of json.data ?? []) {
            const headerId = normalizeCostHeaderIdOfDetail(row);
            if (headerId > 0) headerIds.push(headerId);
        }
    }

    return Array.from(new Set(headerIds));
}

async function getAllCostBatchHeaderIds(): Promise<number[]> {
    const headerIds: number[] = [];
    let offset = 0;
    const limit = 500;

    while (true) {
        const params = new URLSearchParams();
        params.set("limit", String(limit));
        params.set("offset", String(offset));
        params.set("fields", "header_id");
        params.set("filter[header_id][_nnull]", "true");

        const url = `${mustBase()}/items/${COST_DETAILS}?${params.toString()}`;
        const json = await fetchDirectus<DirectusList<CostDetailRow>>(url, { headers: directusHeaders() });
        const rows = json.data ?? [];

        for (const row of rows) {
            const headerId = normalizeCostHeaderIdOfDetail(row);
            if (headerId > 0) headerIds.push(headerId);
        }

        if (rows.length < limit) break;
        offset += rows.length;
    }

    return Array.from(new Set(headerIds));
}

async function getAllPriceBatchHeaderIds(): Promise<number[]> {
    const headerIds: number[] = [];
    let offset = 0;
    const limit = 500;

    while (true) {
        const params = new URLSearchParams();
        params.set("limit", String(limit));
        params.set("offset", String(offset));
        params.set("fields", "header_id");
        params.set("filter[header_id][_nnull]", "true");

        const url = `${mustBase()}/items/${DETAILS}?${params.toString()}`;
        const json = await fetchDirectus<DirectusList<BatchDetailRow>>(url, { headers: directusHeaders() });
        const rows = json.data ?? [];

        for (const row of rows) {
            const headerId = headerIdOfDetail(row);
            if (headerId > 0) headerIds.push(headerId);
        }

        if (rows.length < limit) break;
        offset += rows.length;
    }

    return Array.from(new Set(headerIds));
}

function intersectHeaderIds(left: number[], right: number[]): number[] {
    const rightSet = new Set(right);
    return left.filter((id) => rightSet.has(id));
}

const HEADER_ID_CHUNK_SIZE = 200;
const STANDALONE_PRODUCT_CHUNK_SIZE = 200;

function appendChunkedHeaderIds(params: URLSearchParams, andIdx: number, headerIds: number[]): number {
    if (headerIds.length === 0) {
        params.set(`filter[_and][${andIdx}][header_id][_in]`, "0");
        return andIdx + 1;
    }

    if (headerIds.length <= HEADER_ID_CHUNK_SIZE) {
        params.set(`filter[_and][${andIdx}][header_id][_in]`, headerIds.join(","));
        return andIdx + 1;
    }

    for (let i = 0; i < headerIds.length; i += HEADER_ID_CHUNK_SIZE) {
        const chunk = headerIds.slice(i, i + HEADER_ID_CHUNK_SIZE);
        const orIdx = Math.floor(i / HEADER_ID_CHUNK_SIZE);
        params.set(`filter[_and][${andIdx}][_or][${orIdx}][header_id][_in]`, chunk.join(","));
    }
    return andIdx + 1;
}

function appendBatchFilters(
    params: URLSearchParams,
    filters: ApprovalFilters,
    priceHeaderIds: number[],
    headerIdsFromSearch?: number[],
) {
    let andIdx = 0;
    const addAnd = (suffix: string, value: string) => {
        params.set(`filter[_and][${andIdx}]${suffix}`, value);
        andIdx += 1;
    };

    andIdx = appendChunkedHeaderIds(params, andIdx, priceHeaderIds);
    if (filters.status) addAnd("[status][_eq]", filters.status);
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
            if (headerIdsFromSearch && headerIdsFromSearch.length > 0) {
                if (headerIdsFromSearch.length <= HEADER_ID_CHUNK_SIZE) {
                    params.set(`filter[_and][${andIdx - 1}][_or][2][header_id][_in]`, headerIdsFromSearch.join(","));
                } else {
                    for (let i = 0; i < headerIdsFromSearch.length; i += HEADER_ID_CHUNK_SIZE) {
                        const chunk = headerIdsFromSearch.slice(i, i + HEADER_ID_CHUNK_SIZE);
                        const orIdx = 2 + Math.floor(i / HEADER_ID_CHUNK_SIZE);
                        params.set(`filter[_and][${andIdx - 1}][_or][${orIdx}][header_id][_in]`, chunk.join(","));
                    }
                }
            }
        }
    }
}

function appendCostBatchFilters(
    params: URLSearchParams,
    filters: ApprovalFilters,
    costHeaderIds: number[],
    headerIdsFromSearch?: number[],
) {
    let andIdx = 0;
    const addAnd = (suffix: string, value: string) => {
        params.set(`filter[_and][${andIdx}]${suffix}`, value);
        andIdx += 1;
    };

    andIdx = appendChunkedHeaderIds(params, andIdx, costHeaderIds);
    if (filters.status) addAnd("[status][_eq]", filters.status);
    if (filters.dateFrom) addAnd("[requested_at][_gte]", filters.dateFrom);
    if (filters.dateTo) addAnd("[requested_at][_lte]", toInclusiveDateToEnd(filters.dateTo));

    if (filters.q) {
        const parsed = parseApprovalSearchQuery(filters.q);
        const headerId = parsed.costRequestId ?? parsed.numericId;

        if (headerId != null) {
            addAnd("[header_id][_eq]", String(headerId));
        } else if (parsed.textContains) {
            addAnd("[_or][0][reference_no][_contains]", parsed.textContains);
            params.set(`filter[_and][${andIdx - 1}][_or][1][remarks][_contains]`, parsed.textContains);
            if (headerIdsFromSearch && headerIdsFromSearch.length > 0) {
                if (headerIdsFromSearch.length <= HEADER_ID_CHUNK_SIZE) {
                    params.set(`filter[_and][${andIdx - 1}][_or][2][header_id][_in]`, headerIdsFromSearch.join(","));
                } else {
                    for (let i = 0; i < headerIdsFromSearch.length; i += HEADER_ID_CHUNK_SIZE) {
                        const chunk = headerIdsFromSearch.slice(i, i + HEADER_ID_CHUNK_SIZE);
                        const orIdx = 2 + Math.floor(i / HEADER_ID_CHUNK_SIZE);
                        params.set(`filter[_and][${andIdx - 1}][_or][${orIdx}][header_id][_in]`, chunk.join(","));
                    }
                }
            }
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

    return andIdx;
}

function appendStandaloneProductChunk(params: URLSearchParams, andIdx: number, productIds: number[]): number {
    if (productIds.length === 0) return andIdx;
    params.set(`filter[_and][${andIdx}][product_id][_in]`, productIds.join(","));
    return andIdx + 1;
}

function chunkIds(ids: number[], size: number): number[][] {
    const chunks: number[][] = [];
    for (let i = 0; i < ids.length; i += size) chunks.push(ids.slice(i, i + size));
    return chunks;
}

async function fetchPriceRequestsDirectPage(
    filters: ApprovalFilters,
    offset: number,
    limit: number,
    supplierProductIds?: number[],
): Promise<{ rows: UnifiedApprovalRow[]; total: number }> {
    const params = new URLSearchParams();
    params.set("limit", String(Math.max(1, limit)));
    params.set("offset", String(Math.max(0, offset)));
    params.set("meta", "total_count");
    params.set("sort", "-requested_at");
    params.set(
        "fields",
        [
            "request_id",
            "header_id",
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

    const nextAndIdx = appendPriceFilters(params, filters, supplierProductIds);
    params.set(`filter[_and][${nextAndIdx}][header_id][_null]`, "true");

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

async function fetchChunkedPriceRequestsPage(
    filters: ApprovalFilters,
    offset: number,
    limit: number,
    supplierProductIds: number[],
): Promise<{ rows: UnifiedApprovalRow[]; total: number }> {
    const needed = offset + limit;
    const pages = await Promise.all(
        chunkIds(supplierProductIds, STANDALONE_PRODUCT_CHUNK_SIZE).map((chunk) =>
            fetchPriceRequestsDirectPage(filters, 0, needed, chunk),
        ),
    );
    const mergedRows = mergeUnifiedRows(...pages.map((page) => page.rows));
    return {
        rows: mergedRows.slice(offset, offset + limit),
        total: pages.reduce((sum, page) => sum + page.total, 0),
    };
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

    if (supplierProductIds && supplierProductIds.length > STANDALONE_PRODUCT_CHUNK_SIZE) {
        return fetchChunkedPriceRequestsPage(filters, offset, limit, supplierProductIds);
    }

    return fetchPriceRequestsDirectPage(filters, offset, limit, supplierProductIds);
}

async function fetchPriceBatchesPage(
    filters: ApprovalFilters,
    offset: number,
    limit: number,
    priceHeaderIds: number[],
    headerIdsFromSearch?: number[],
): Promise<{ rows: UnifiedApprovalRow[]; total: number }> {
    if (priceHeaderIds.length === 0) {
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
            "header_id",
            "supplier_id",
            "supplier_id.id",
            "supplier_id.supplier_name",
            "supplier_id.supplier_shortcut",
            "reference_no",
            "remarks",
            "status",
            "requested_by",
            "requested_at",
        ].join(","),
    );

    appendBatchFilters(params, filters, priceHeaderIds, headerIdsFromSearch);

    const url = `${mustBase()}/items/${HEADERS}?${params.toString()}`;
    const json = await fetchDirectus<DirectusList<BatchHeaderRow>>(url, { headers: directusHeaders() });
    const headerRows = json.data ?? [];
    const headerIds = headerRows.map(normalizeHeaderId).filter((id) => id > 0);
    const summaries = await summarizeBatchLines(headerIds);

    const rows: UnifiedApprovalRow[] = [];
    for (const row of headerRows) {
        const headerId = normalizeHeaderId(row);
        if (!headerId) continue;

        const requestedBy = Number(row.requested_by);
        const summary = summaries.get(headerId);
        const supplierName = supplierNameOf(row.supplier_id);
        const supplierNames = supplierName ? [supplierName] : [];
        const referenceNo = String(row.reference_no ?? "").trim();
        const remarks = String(row.remarks ?? "").trim();
        const proposedMin = summary?.proposedMin ?? null;
        const proposedMax = summary?.proposedMax ?? null;

        rows.push({
            row_key: `batch:${headerId}`,
            kind: "price_batch",
            record_label: `PCB-${headerId}`,
            title: supplierName || referenceNo || `Price change batch #${headerId}`,
            subtitle: remarks || referenceNo || undefined,
            status: String(row.status ?? "PENDING"),
            requested_at: row.requested_at ?? null,
            requested_by: Number.isFinite(requestedBy) ? requestedBy : null,
            request_id: headerId,
            batch_id: headerId,
            line_count: summary?.lineCount ?? 0,
            total_products: summary?.totalProducts ?? 0,
            proposed_min: proposedMin,
            proposed_max: proposedMax,
            proposed_price: proposedMin === proposedMax ? proposedMin : null,
            remarks: remarks || null,
            reference_no: referenceNo || null,
            supplier_id: supplierIdOf(row.supplier_id),
            supplier_name: supplierName || null,
            supplier_names: supplierNames,
        });
    }

    return {
        rows,
        total: Number(json.meta?.total_count ?? rows.length),
    };
}

async function fetchCostBatchesPage(
    filters: ApprovalFilters,
    offset: number,
    limit: number,
    costHeaderIds: number[],
    headerIdsFromSearch?: number[],
): Promise<{ rows: UnifiedApprovalRow[]; total: number }> {
    if (costHeaderIds.length === 0) {
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
            "header_id",
            "reference_no",
            "remarks",
            "status",
            "requested_by",
            "requested_at",
        ].join(","),
    );

    appendCostBatchFilters(params, filters, costHeaderIds, headerIdsFromSearch);

    const url = `${mustBase()}/items/${COST_HEADERS}?${params.toString()}`;
    const json = await fetchDirectus<DirectusList<CostHeaderRow>>(url, { headers: directusHeaders() });
    const headerRows = json.data ?? [];
    const headerIds = headerRows.map(normalizeCostHeaderId).filter((id) => id > 0);
    const summaries = await summarizeCostBatchLines(headerIds);

    const allCostProductIds = Array.from(
        new Set(
            Array.from(summaries.values()).flatMap((s) => s.productIds),
        ),
    );
    const supplierByProductId = await fetchSupplierByProductIds(allCostProductIds);

    const rows: UnifiedApprovalRow[] = [];
    for (const row of headerRows) {
        const headerId = normalizeCostHeaderId(row);
        if (!headerId) continue;

        const requestedBy = Number(row.requested_by);
        const summary = summaries.get(headerId);
        const referenceNo = String(row.reference_no ?? "").trim();
        const remarks = String(row.remarks ?? "").trim();
        const proposedMin = summary?.proposedMin ?? null;
        const proposedMax = summary?.proposedMax ?? null;

        const batchSupplierInfos = (summary?.productIds ?? [])
            .flatMap((pid) => supplierByProductId.get(pid) ?? []);
        const batchSupplierNames = uniqueSupplierNamesFromInfos(batchSupplierInfos);
        const batchSupplierName = resolveSupplierName(batchSupplierInfos);

        rows.push({
            row_key: `cost-batch:${headerId}`,
            kind: "cost_batch",
            record_label: `CCR-${headerId}`,
            title: remarks || referenceNo || `List cost batch #${headerId}`,
            subtitle: remarks && referenceNo ? referenceNo : undefined,
            status: String(row.status ?? "PENDING"),
            requested_at: row.requested_at ?? null,
            requested_by: Number.isFinite(requestedBy) ? requestedBy : null,
            request_id: headerId,
            batch_id: headerId,
            line_count: summary?.lineCount ?? 0,
            total_products: summary?.totalProducts ?? 0,
            proposed_min: proposedMin,
            proposed_max: proposedMax,
            proposed_cost: proposedMin === proposedMax ? proposedMin : null,
            remarks: remarks || null,
            reference_no: referenceNo || null,
            supplier_name: batchSupplierName !== "-" ? batchSupplierName : null,
            supplier_names: batchSupplierNames,
        });
    }

    return {
        rows,
        total: Number(json.meta?.total_count ?? rows.length),
    };
}

async function fetchCostRequestsDirectPage(
    filters: ApprovalFilters,
    offset: number,
    limit: number,
    supplierProductIds?: number[],
): Promise<{ rows: UnifiedApprovalRow[]; total: number }> {
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

    let nextAndIdx = appendCostFilters(params, filters, undefined);
    if (supplierProductIds && supplierProductIds.length > 0) {
        nextAndIdx = appendStandaloneProductChunk(params, nextAndIdx, supplierProductIds);
    }
    const linkedFilterKey = `filter[_and][${nextAndIdx}][header_id][_null]`;
    params.set(linkedFilterKey, "true");

    let json: DirectusList<DirectusCCRRow>;
    try {
        const url = `${mustBase()}/items/${CCR}?${params.toString()}`;
        json = await fetchDirectus<DirectusList<DirectusCCRRow>>(url, { headers: directusHeaders() });
    } catch (error: unknown) {
        if (!isCostHeaderAccessError(error)) throw error;

        params.delete(linkedFilterKey);
        const fallbackUrl = `${mustBase()}/items/${CCR}?${params.toString()}`;
        json = await fetchDirectus<DirectusList<DirectusCCRRow>>(fallbackUrl, { headers: directusHeaders() });
    }

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

async function fetchChunkedCostRequestsPage(
    filters: ApprovalFilters,
    offset: number,
    limit: number,
    supplierProductIds: number[],
): Promise<{ rows: UnifiedApprovalRow[]; total: number }> {
    const needed = offset + limit;
    const pages = await Promise.all(
        chunkIds(supplierProductIds, STANDALONE_PRODUCT_CHUNK_SIZE).map((chunk) =>
            fetchCostRequestsDirectPage(filters, 0, needed, chunk),
        ),
    );
    const mergedRows = mergeUnifiedRows(...pages.map((page) => page.rows));
    return {
        rows: mergedRows.slice(offset, offset + limit),
        total: pages.reduce((sum, page) => sum + page.total, 0),
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

    if (supplierProductIds && supplierProductIds.length > STANDALONE_PRODUCT_CHUNK_SIZE) {
        return fetchChunkedCostRequestsPage(filters, offset, limit, supplierProductIds);
    }

    return fetchCostRequestsDirectPage(filters, offset, limit, supplierProductIds);
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
        const scope = norm(searchParams.get("scope"));
        const page = Math.max(1, Number(searchParams.get("page") ?? 1));
        const pageSize = Math.min(100, Math.max(10, Number(searchParams.get("page_size") ?? 50)));

        const filters: ApprovalFilters = { status, supplierIds, q, dateFrom, dateTo };
        const offset = (page - 1) * pageSize;
        let needed = offset + pageSize;

        const searchParse = q ? parseApprovalSearchQuery(q) : null;
        const includePriceScope = scope !== "cost";
        const includeCostScope = scope !== "price";
        const includePrice = includePriceScope && (!searchParse || shouldFetchPriceStreamInUnifiedSearch(searchParse));
        const includeCost = includeCostScope && (!searchParse || shouldFetchCostStreamInUnifiedSearch(searchParse));
        const includeBatch =
            includePrice &&
            (!searchParse ||
                searchParse.batchHeaderId != null ||
                searchParse.numericId != null ||
                searchParse.textContains != null);
        const includeCostBatch =
            includeCost &&
            (!searchParse ||
                searchParse.costRequestId != null ||
                searchParse.numericId != null ||
                searchParse.textContains != null);
        const includeStandalonePrice =
            includePrice &&
            !(
                searchParse &&
                searchParse.batchHeaderId != null &&
                searchParse.numericId == null &&
                searchParse.priceRequestId == null &&
                searchParse.costRequestId == null
            );

        const supplierProductIds =
            supplierIds.length > 0
                ? await getSupplierScopedProductIdsForSuppliers(supplierIds)
                : undefined;
        let priceBatchHeaderIds: number[] = [];
        if (includeBatch) {
            const allPriceBatchHeaderIds = await getAllPriceBatchHeaderIds();
            if (supplierIds.length > 0) {
                const supplierPriceBatchHeaderIds = supplierProductIds
                    ? await getBatchHeaderIdsForProducts(supplierProductIds)
                    : [];
                priceBatchHeaderIds = intersectHeaderIds(allPriceBatchHeaderIds, supplierPriceBatchHeaderIds);
            } else {
                priceBatchHeaderIds = allPriceBatchHeaderIds;
            }
        }
        let costBatchHeaderIds: number[] = [];
        if (includeCostBatch) {
            try {
                costBatchHeaderIds = supplierProductIds
                    ? await getCostHeaderIdsForProducts(supplierProductIds)
                    : await getAllCostBatchHeaderIds();
            } catch (error: unknown) {
                if (!isCostHeaderAccessError(error)) throw error;
                costBatchHeaderIds = [];
            }
        }
        const batchHeaderIdsFromSearch =
            includeBatch && searchParse?.textContains
                ? await getBatchHeaderIdsForProductSearch(searchParse.textContains)
                : undefined;
        let costHeaderIdsFromSearch: number[] | undefined;
        if (includeCostBatch && searchParse?.textContains) {
            try {
                costHeaderIdsFromSearch = await getCostHeaderIdsForProductSearch(searchParse.textContains);
            } catch (error: unknown) {
                if (!isCostHeaderAccessError(error)) throw error;
                costHeaderIdsFromSearch = [];
            }
        }

        const emptyStreamPage = () => Promise.resolve({ rows: [], total: 0 });

        const fetchBatchTop = includeBatch
            ? (fetchNeeded: number) =>
                  fetchStreamTopRows(
                      (streamOffset, streamLimit) =>
                          fetchPriceBatchesPage(
                              filters,
                              streamOffset,
                              streamLimit,
                              priceBatchHeaderIds,
                              batchHeaderIdsFromSearch,
                          ),
                      fetchNeeded,
                  )
            : emptyStreamPage;

        const fetchPriceTop = includeStandalonePrice
            ? (fetchNeeded: number) =>
                  fetchStreamTopRows(
                      (streamOffset, streamLimit) =>
                          fetchPriceRequestsPage(filters, streamOffset, streamLimit, supplierProductIds),
                      fetchNeeded,
                  )
            : emptyStreamPage;

        const fetchCostTop = includeCost
            ? (fetchNeeded: number) =>
                  fetchStreamTopRows(
                      (streamOffset, streamLimit) =>
                          fetchCostRequestsPage(filters, streamOffset, streamLimit, supplierProductIds),
                      fetchNeeded,
                  )
            : emptyStreamPage;

        const fetchCostBatchTop = includeCostBatch
            ? (fetchNeeded: number) =>
                  fetchStreamTopRows(
                      (streamOffset, streamLimit) =>
                          fetchCostBatchesPage(
                              filters,
                              streamOffset,
                              streamLimit,
                              costBatchHeaderIds,
                              costHeaderIdsFromSearch,
                          ),
                      fetchNeeded,
                  )
            : emptyStreamPage;

        let [batchPage, pricePage, costBatchPage, costPage] = await Promise.all([
            fetchBatchTop(needed),
            fetchPriceTop(needed),
            fetchCostBatchTop(needed),
            fetchCostTop(needed),
        ]);

        let merged = mergeUnifiedRows(batchPage.rows, pricePage.rows, costBatchPage.rows, costPage.rows);
        let data = merged.slice(offset, offset + pageSize);

        const totalCount = batchPage.total + pricePage.total + costBatchPage.total + costPage.total;

        if (
            data.length < pageSize &&
            offset + data.length < totalCount &&
            needed < MAX_UNIFIED_FETCH
        ) {
            needed = Math.min(needed * 2, MAX_UNIFIED_FETCH);
            [batchPage, pricePage, costBatchPage, costPage] = await Promise.all([
                fetchBatchTop(needed),
                fetchPriceTop(needed),
                fetchCostBatchTop(needed),
                fetchCostTop(needed),
            ]);
            merged = mergeUnifiedRows(batchPage.rows, pricePage.rows, costBatchPage.rows, costPage.rows);
            data = merged.slice(offset, offset + pageSize);
        }

        let enrichedData = await addRequestedByNames(data);
        enrichedData = await addSuppliersToRows(enrichedData);

        return NextResponse.json({
            data: enrichedData,
            meta: { total_count: totalCount },
        });
    } catch (error: unknown) {
        return directusErrorResponse(error);
    }
}
