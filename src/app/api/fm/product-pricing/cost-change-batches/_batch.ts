import { NextResponse } from "next/server";

import { invalidateGroupIndexCacheOnCatalogChange } from "../_productGroupIndexCache";
import {
    decodeUserIdFromJwtCookie,
    directusErrorResponse,
    directusHeaders,
    fetchDirectus,
    fetchUserNamesById,
    getSupplierNamesByProductId,
    HEADERS,
    isRecord,
    mustBase,
    nowManila,
    pickId,
    resolveBatchDecisionUserNames,
    resolveUserDisplayName,
} from "../price-change-batches/_batch";

import type { NormalizedCostBulkItem } from "../cost-change-requests/_bulk";

export {
    decodeUserIdFromJwtCookie,
    directusErrorResponse,
    fetchUserNamesById,
    getSupplierNamesByProductId,
    isRecord,
    pickId,
    resolveBatchDecisionUserNames,
    resolveUserDisplayName,
};

export const COST_HEADERS = HEADERS;
export const COST_DETAILS = "cost_change_requests";
export const PRODUCTS = "products";

type DirectusSingle<T> = { data?: T };
type DirectusList<T> = { data?: T[] };

const COST_BATCH_STORAGE_ERROR =
    "List cost batch storage is not configured. Confirm cost_change_requests.header_id exists and is readable/writable by the Directus token.";

type DirectusUserRelation = {
    id?: number | string | null;
    user_id?: number | string | null;
    user_fname?: string | null;
    user_mname?: string | null;
    user_lname?: string | null;
    suffix_name?: string | null;
    nickname?: string | null;
    user_email?: string | null;
};

export type CostHeaderRow = {
    id?: number | string | null;
    header_id?: number | string | null;
    reference_no?: string | null;
    remarks?: string | null;
    status?: string | null;
    requested_by?: number | string | DirectusUserRelation | null;
    requested_at?: string | null;
    approved_by?: number | string | DirectusUserRelation | null;
    approved_at?: string | null;
    rejected_by?: number | string | DirectusUserRelation | null;
    rejected_at?: string | null;
    reject_reason?: string | null;
};

export type CostDetailRow = {
    request_id?: number | string | null;
    header_id?: number | string | CostHeaderRow | null;
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
    requested_by?: number | string | null;
    requested_at?: string | null;
    reject_reason?: string | null;
};

export function normalizeCostHeaderId(header: CostHeaderRow): number {
    return pickId(header.header_id) ?? pickId(header.id) ?? 0;
}

export function normalizeCostProductId(detail: CostDetailRow): number {
    return pickId(detail.product_id) ?? 0;
}

export function normalizeCostHeaderIdOfDetail(detail: CostDetailRow): number {
    const raw = detail.header_id;
    if (isRecord(raw)) return pickId(raw.header_id ?? raw.id) ?? 0;
    return pickId(raw) ?? 0;
}

function normalizeCostRequestId(detail: CostDetailRow): number {
    return pickId(detail.request_id) ?? 0;
}

function isHeaderFieldAccessError(error: unknown): boolean {
    if (!(error instanceof Error) || !error.message) return false;

    try {
        const parsed: unknown = JSON.parse(error.message);
        if (!isRecord(parsed)) return false;

        const status = Number(parsed.status);
        const url = String(parsed.url ?? "");
        const body = String(parsed.body ?? "");
        const text = `${url} ${body}`.toLowerCase();

        return [400, 401, 403, 404].includes(status) && text.includes(COST_DETAILS) && text.includes("header_id");
    } catch {
        return false;
    }
}

export async function assertCostBatchStorageReady() {
    const params = new URLSearchParams();
    params.set("limit", "1");
    params.set("fields", "request_id,header_id");

    try {
        await fetchDirectus<DirectusList<Pick<CostDetailRow, "request_id" | "header_id">>>(
            `${mustBase()}/items/${COST_DETAILS}?${params.toString()}`,
            { headers: directusHeaders() },
        );
    } catch (error: unknown) {
        if (isHeaderFieldAccessError(error)) {
            throw new Error(COST_BATCH_STORAGE_ERROR);
        }
        throw error;
    }
}

export function isCostBatchStorageSetupError(error: unknown): error is Error {
    return error instanceof Error && error.message === COST_BATCH_STORAGE_ERROR;
}

export function mapCostBatchHeaderResponse(row: CostHeaderRow, lineCount = 0) {
    const headerId = normalizeCostHeaderId(row);
    return {
        id: headerId,
        header_id: headerId,
        reference_no: row.reference_no ?? "",
        remarks: row.remarks ?? "",
        status: row.status ?? "PENDING",
        requested_by: row.requested_by ?? null,
        requested_at: row.requested_at ?? null,
        approved_by: row.approved_by ?? null,
        approved_at: row.approved_at ?? null,
        rejected_by: row.rejected_by ?? null,
        rejected_at: row.rejected_at ?? null,
        reject_reason: row.reject_reason ?? null,
        line_count: lineCount,
    };
}

export async function createPendingCostBatch(args: {
    userId: number;
    itemsToCreate: NormalizedCostBulkItem[];
    referenceNo?: string;
    remarks?: string;
}) {
    const { userId, itemsToCreate } = args;
    if (itemsToCreate.length === 0) {
        return { created: 0, headerId: 0, headerRow: null as CostHeaderRow | null, detailRows: [] as CostDetailRow[] };
    }

    await assertCostBatchStorageReady();

    const requestedAt = nowManila();
    const headerPayload = {
        reference_no: args.referenceNo?.trim() || null,
        remarks: args.remarks?.trim() || "List cost change request",
        status: "PENDING",
        requested_by: userId,
        requested_at: requestedAt,
    };

    const header = await fetchDirectus<DirectusSingle<CostHeaderRow>>(`${mustBase()}/items/${COST_HEADERS}`, {
        method: "POST",
        headers: directusHeaders(),
        body: JSON.stringify(headerPayload),
    });

    const headerId = header.data ? normalizeCostHeaderId(header.data) : 0;
    if (!headerId) throw new Error("Cost change header was created without an id");

    const detailPayload = itemsToCreate.map((item) => ({
        header_id: headerId,
        product_id: item.product_id,
        current_cost: item.current_cost,
        proposed_cost: item.proposed_cost,
        status: "PENDING",
        requested_by: userId,
        requested_at: requestedAt,
    }));

    const details = await fetchDirectus<DirectusList<CostDetailRow>>(`${mustBase()}/items/${COST_DETAILS}`, {
        method: "POST",
        headers: directusHeaders(),
        body: JSON.stringify(detailPayload),
    });
    const createdDetails = details.data ?? [];

    const detailsMissingHeader = createdDetails.filter((detail) => {
        const requestId = normalizeCostRequestId(detail);
        return requestId > 0 && normalizeCostHeaderIdOfDetail(detail) !== headerId;
    });

    if (detailsMissingHeader.length > 0) {
        await Promise.all(
            detailsMissingHeader.map((detail) =>
                fetchDirectus(`${mustBase()}/items/${COST_DETAILS}/${normalizeCostRequestId(detail)}`, {
                    method: "PATCH",
                    headers: directusHeaders(),
                    body: JSON.stringify({ header_id: headerId }),
                }),
            ),
        );
    }

    const linkedDetails = await getCostDetails(headerId);
    if (linkedDetails.length === 0) {
        throw new Error(
            "List cost batch header was created, but Directus did not save cost_change_requests.header_id. Confirm cost_change_requests.header_id exists and is writable.",
        );
    }

    return {
        headerId,
        created: linkedDetails.length,
        headerRow: header.data ?? { header_id: headerId },
        detailRows: linkedDetails,
    };
}

export async function getCostHeader(headerId: number) {
    const params = new URLSearchParams();
    params.set(
        "fields",
        [
            "header_id",
            "reference_no",
            "remarks",
            "status",
            "requested_by",
            "requested_by.user_id",
            "requested_by.user_fname",
            "requested_by.user_mname",
            "requested_by.user_lname",
            "requested_by.user_email",
            "requested_at",
            "approved_by",
            "approved_by.user_id",
            "approved_by.user_fname",
            "approved_by.user_mname",
            "approved_by.user_lname",
            "approved_by.suffix_name",
            "approved_by.nickname",
            "approved_by.user_email",
            "approved_at",
            "rejected_by",
            "rejected_by.user_id",
            "rejected_by.user_fname",
            "rejected_by.user_mname",
            "rejected_by.user_lname",
            "rejected_by.suffix_name",
            "rejected_by.nickname",
            "rejected_by.user_email",
            "rejected_at",
            "reject_reason",
        ].join(","),
    );

    const url = `${mustBase()}/items/${COST_HEADERS}/${headerId}?${params.toString()}`;
    const json = await fetchDirectus<DirectusSingle<CostHeaderRow>>(url, { headers: directusHeaders() });
    return json.data ?? null;
}

export async function getCostDetails(headerId: number) {
    const params = new URLSearchParams();
    params.set("limit", "-1");
    params.set("sort", "request_id");
    params.set("filter[header_id][_eq]", String(headerId));
    params.set(
        "fields",
        [
            "request_id",
            "header_id",
            "product_id",
            "product_id.product_id",
            "product_id.product_code",
            "product_id.product_name",
            "product_id.unit_of_measurement.unit_id",
            "product_id.unit_of_measurement.unit_name",
            "product_id.unit_of_measurement.unit_shortcut",
            "current_cost",
            "proposed_cost",
            "status",
            "requested_by",
            "requested_at",
            "reject_reason",
        ].join(","),
    );

    const url = `${mustBase()}/items/${COST_DETAILS}?${params.toString()}`;
    const json = await fetchDirectus<DirectusList<CostDetailRow>>(url, { headers: directusHeaders() });
    return json.data ?? [];
}

async function patchProductCostField(args: { productId: number; proposedCost: number }) {
    await fetchDirectus(`${mustBase()}/items/${PRODUCTS}/${args.productId}`, {
        method: "PATCH",
        headers: directusHeaders(),
        body: JSON.stringify({ cost_per_unit: args.proposedCost }),
    });
}

export async function approveCostBatch(headerId: number, userId: number) {
    const header = await getCostHeader(headerId);
    if (!header) return NextResponse.json({ error: "Cost batch not found" }, { status: 404 });
    if (String(header.status ?? "") !== "PENDING") {
        return NextResponse.json({ error: "Only PENDING cost batches can be approved." }, { status: 400 });
    }

    const details = await getCostDetails(headerId);
    if (details.length === 0) {
        return NextResponse.json({ error: "Cost batch has no detail lines." }, { status: 400 });
    }

    const normalized = details.map((line) => ({
        requestId: pickId(line.request_id) ?? 0,
        productId: normalizeCostProductId(line),
        proposedCost: Number(line.proposed_cost),
    }));

    for (const line of normalized) {
        if (!line.productId || !Number.isFinite(line.proposedCost)) {
            return NextResponse.json({ error: "Cost batch contains an invalid detail line." }, { status: 400 });
        }
    }

    for (const line of normalized) {
        await patchProductCostField({ productId: line.productId, proposedCost: line.proposedCost });
    }

    await fetchDirectus(`${mustBase()}/items/${COST_HEADERS}/${headerId}`, {
        method: "PATCH",
        headers: directusHeaders(),
        body: JSON.stringify({
            status: "APPROVED",
            approved_by: userId,
            approved_at: nowManila(),
        }),
    });

    await Promise.all(
        normalized
            .filter((line) => line.requestId > 0)
            .map((line) =>
                fetchDirectus(`${mustBase()}/items/${COST_DETAILS}/${line.requestId}`, {
                    method: "PATCH",
                    headers: directusHeaders(),
                    body: JSON.stringify({ status: "APPROVED" }),
                }),
            ),
    );

    invalidateGroupIndexCacheOnCatalogChange();

    return NextResponse.json({ ok: true, header_id: headerId, affected: normalized.length });
}

export async function rejectCostBatch(headerId: number, userId: number, rejectReason: string) {
    const header = await getCostHeader(headerId);
    if (!header) return NextResponse.json({ error: "Cost batch not found" }, { status: 404 });
    if (String(header.status ?? "") !== "PENDING") {
        return NextResponse.json({ error: "Only PENDING cost batches can be rejected." }, { status: 400 });
    }

    const details = await getCostDetails(headerId);

    await fetchDirectus(`${mustBase()}/items/${COST_HEADERS}/${headerId}`, {
        method: "PATCH",
        headers: directusHeaders(),
        body: JSON.stringify({
            status: "REJECTED",
            rejected_by: userId,
            rejected_at: nowManila(),
            reject_reason: rejectReason,
        }),
    });

    await Promise.all(
        details
            .map((line) => pickId(line.request_id))
            .filter((lineId): lineId is number => Boolean(lineId))
            .map((lineId) =>
                fetchDirectus(`${mustBase()}/items/${COST_DETAILS}/${lineId}`, {
                    method: "PATCH",
                    headers: directusHeaders(),
                    body: JSON.stringify({
                        status: "REJECTED",
                        reject_reason: rejectReason,
                    }),
                }),
            ),
    );

    return NextResponse.json({ ok: true, header_id: headerId, rejected: details.length });
}

export function costBatchErrorResponse(error: unknown) {
    const response = directusErrorResponse(error);
    return response;
}
