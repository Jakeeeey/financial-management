import { randomUUID } from "node:crypto";

import {
    DETAILS as PRICE_DETAILS,
    directusHeaders,
    fetchDirectus,
    findPriceSnapshotConflicts,
    getDetails as getPriceDetails,
    getHeader,
    isRecord,
    mustBase,
    normalizeHeaderId,
    nowManila,
    pickId,
} from "./price-change-batches/_batch";
import {
    COST_DETAILS,
    getCostDetails,
} from "./cost-change-batches/_batch";
import { applyProposedPrice } from "./price-change-requests/_actions";
import { patchProductCostField } from "./cost-change-requests/_actions";
import { assertValidProposedCost } from "./cost-change-requests/_costValidation";
import {
    executeClaimedApplication,
    fallbackApplicationStatus,
    postCommitApplicationNotice,
} from "./_applicationEngine";
import { isValidPriceValue } from "./_pricePrecision";

type DirectusList<T> = { data?: T[] };

type DetailRow = {
    request_id?: number | string | null;
    header_id?: number | string | null;
    product_id?: unknown;
    price_type_id?: unknown;
    current_price?: number | string | null;
    proposed_price?: number | string | null;
    current_cost?: number | string | null;
    proposed_cost?: number | string | null;
    status?: string | null;
    requested_by?: unknown;
    requested_at?: string | null;
    effective_at?: string | null;
    application_status?: string | null;
    application_lock_id?: string | null;
    application_started_at?: string | null;
    application_attempts?: number | string | null;
    application_error?: string | null;
    applied_at?: string | null;
    applied_by?: unknown;
};

export type UnifiedBatchLine = {
    request_id: number | null;
    kind: "price_type" | "list_cost";
    product_id: number;
    product_name: string;
    product_code: string;
    unit_name: string;
    price_type_id?: number;
    price_type_name?: string;
    current_price?: number | null;
    proposed_price?: number | null;
    current_cost?: number | null;
    proposed_cost?: number | null;
    delta: number | null;
    percent_change: number | null;
    status: string;
    effective_at?: string | null;
    application_status?: string | null;
    applied_at?: string | null;
    applied_by?: unknown;
};

export type UnifiedBatchData = {
    id: number;
    header_id: number;
    supplier_id: number | null;
    supplier_name: string;
    reference_no: string;
    remarks: string;
    status: string;
    requested_by: number | null;
    requested_at: string | null;
    approved_by?: unknown;
    approved_at?: string | null;
    rejected_by?: unknown;
    rejected_at?: string | null;
    reject_reason?: string | null;
    effective_at?: string | null;
    application_status?: string | null;
    applied_at?: string | null;
    applied_by?: unknown;
    price_details: UnifiedBatchLine[];
    cost_details: UnifiedBatchLine[];
    batch_types: Array<"PRICE_TYPE" | "LIST_COST">;
};

function productValue(value: unknown, key: string): string {
    return isRecord(value) ? String(value[key] ?? "").trim() : "";
}

function productUom(value: unknown): string {
    if (!isRecord(value) || !isRecord(value.unit_of_measurement)) return "";
    return String(
        value.unit_of_measurement.unit_shortcut ?? value.unit_of_measurement.unit_name ?? "",
    ).trim();
}

function numberOrNull(value: unknown): number | null {
    if (value === null || value === undefined || value === "") return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

function userIdOf(value: unknown): number | null {
    const id = isRecord(value) ? pickId(value.user_id ?? value.id) : pickId(value);
    return id ?? null;
}

function detailProductId(line: DetailRow): number {
    return isRecord(line.product_id) ? pickId(line.product_id.product_id) ?? 0 : pickId(line.product_id) ?? 0;
}

function detailPriceTypeId(line: DetailRow): number {
    return isRecord(line.price_type_id)
        ? pickId(line.price_type_id.price_type_id) ?? 0
        : pickId(line.price_type_id) ?? 0;
}

function supplierNameOf(value: unknown): string {
    if (!isRecord(value)) return "";
    const shortcut = String(value.supplier_shortcut ?? "").trim();
    const name = String(value.supplier_name ?? "").trim();
    return shortcut && name ? `${shortcut} - ${name}` : name || shortcut;
}

function mapPriceLine(line: DetailRow): UnifiedBatchLine {
    const current = numberOrNull(line.current_price);
    const proposed = numberOrNull(line.proposed_price);
    const delta = current !== null && proposed !== null ? proposed - current : null;

    return {
        request_id: pickId(line.request_id),
        kind: "price_type",
        product_id: detailProductId(line),
        product_name: productValue(line.product_id, "product_name"),
        product_code: productValue(line.product_id, "product_code"),
        unit_name: productUom(line.product_id),
        price_type_id: detailPriceTypeId(line),
        price_type_name: productValue(line.price_type_id, "price_type_name"),
        current_price: current,
        proposed_price: proposed,
        delta,
        percent_change: delta !== null && current !== null && current !== 0 ? (delta / current) * 100 : null,
        status: String(line.status ?? "PENDING"),
        effective_at: line.effective_at ?? null,
        application_status: line.application_status ?? null,
        applied_at: line.applied_at ?? null,
        applied_by: line.applied_by,
    };
}

function mapCostLine(line: DetailRow): UnifiedBatchLine {
    const current = numberOrNull(line.current_cost);
    const proposed = numberOrNull(line.proposed_cost);
    const delta = current !== null && proposed !== null ? proposed - current : null;

    return {
        request_id: pickId(line.request_id),
        kind: "list_cost",
        product_id: detailProductId(line),
        product_name: productValue(line.product_id, "product_name"),
        product_code: productValue(line.product_id, "product_code"),
        unit_name: productUom(line.product_id),
        current_cost: current,
        proposed_cost: proposed,
        delta,
        percent_change: delta !== null && current !== null && current !== 0 ? (delta / current) * 100 : null,
        status: String(line.status ?? "PENDING"),
        effective_at: line.effective_at ?? null,
        application_status: line.application_status ?? null,
        applied_at: line.applied_at ?? null,
        applied_by: line.applied_by,
    };
}

export async function getUnifiedBatch(headerId: number): Promise<UnifiedBatchData | null> {
    const header = await getHeader(headerId);
    if (!header) return null;

    const [priceDetails, costDetails] = await Promise.all([
        getPriceDetails(headerId) as Promise<DetailRow[]>,
        getCostDetails(headerId) as Promise<DetailRow[]>,
    ]);
    const normalizedHeaderId = normalizeHeaderId(header);
    const price = priceDetails.map(mapPriceLine);
    const cost = costDetails.map(mapCostLine);
    const supplierId = isRecord(header.supplier_id)
        ? pickId(header.supplier_id.id)
        : pickId(header.supplier_id);
    const requestedBy = userIdOf(header.requested_by);

    return {
        id: normalizedHeaderId,
        header_id: normalizedHeaderId,
        supplier_id: supplierId,
        supplier_name: supplierNameOf(header.supplier_id),
        reference_no: String(header.reference_no ?? ""),
        remarks: String(header.remarks ?? ""),
        status: String(header.status ?? "PENDING"),
        requested_by: requestedBy,
        requested_at: header.requested_at ?? null,
        approved_by: header.approved_by,
        approved_at: header.approved_at ?? null,
        rejected_by: header.rejected_by,
        rejected_at: header.rejected_at ?? null,
        reject_reason: header.reject_reason ?? null,
        effective_at: header.effective_at ?? null,
        application_status: header.application_status ?? null,
        applied_at: header.applied_at ?? null,
        applied_by: header.applied_by,
        price_details: price,
        cost_details: cost,
        batch_types: [
            ...(price.length > 0 ? (["PRICE_TYPE"] as const) : []),
            ...(cost.length > 0 ? (["LIST_COST"] as const) : []),
        ],
    };
}

export async function isMixedBatch(headerId: number): Promise<boolean> {
    try {
        const batch = await getUnifiedBatch(headerId);
        return Boolean(batch && batch.price_details.length > 0 && batch.cost_details.length > 0);
    } catch {
        return false;
    }
}

async function patchFiltered<T>(
    collection: string,
    filter: Record<string, unknown>,
    patch: Record<string, unknown>,
    fields: string,
): Promise<T[]> {
    const response = await fetchDirectus<DirectusList<T>>(`${mustBase()}/items/${collection}`, {
        method: "PATCH",
        headers: directusHeaders(),
        body: JSON.stringify({ data: patch, query: { filter, fields: fields.split(",") } }),
    });
    return response.data ?? [];
}

async function fetchApplicationRows(collection: string, headerId: number): Promise<DetailRow[]> {
    const params = new URLSearchParams();
    params.set("limit", "-1");
    const fields = collection === PRICE_DETAILS
        ? "request_id,header_id,product_id,price_type_id,current_price,proposed_price,status,effective_at,application_status,application_lock_id,application_started_at,application_attempts,application_error"
        : "request_id,header_id,product_id,current_cost,proposed_cost,status,effective_at,application_status,application_lock_id,application_started_at,application_attempts,application_error";
    params.set(
        "fields",
        fields,
    );
    params.set("filter[header_id][_eq]", String(headerId));
    const response = await fetchDirectus<DirectusList<DetailRow>>(
        `${mustBase()}/items/${collection}?${params.toString()}`,
        { headers: directusHeaders() },
    );
    return response.data ?? [];
}

async function claimHeader(headerId: number) {
    const lockId = randomUUID();
    const now = nowManila();
    const claimed = await patchFiltered(
        "price_change_headers",
        {
            _and: [
                { header_id: { _eq: headerId } },
                { status: { _eq: "PENDING" } },
                {
                    _or: [
                        { application_status: { _null: true } },
                        { application_status: { _eq: "FAILED" } },
                    ],
                },
            ],
        },
        {
            application_status: "APPLYING",
            application_lock_id: lockId,
            application_started_at: now,
            application_error: null,
        },
        "header_id,status,application_status,application_lock_id",
    );

    return claimed[0] ? { lockId, now } : null;
}

async function stageDetails(collection: string, headerId: number, userId: number, now: string, effectiveAt: string, expected: number) {
    const rows = await patchFiltered<DetailRow>(
        collection,
        { _and: [{ header_id: { _eq: headerId } }, { status: { _eq: "PENDING" } }] },
        {
            status: "APPROVED",
            approved_by: userId,
            approved_at: now,
            effective_at: effectiveAt,
            application_status: "SCHEDULED",
            application_lock_id: null,
            application_started_at: null,
            application_attempts: 0,
            application_error: null,
            applied_at: null,
            applied_by: null,
        },
        "request_id,header_id,status,effective_at,application_status",
    );

    if (rows.length !== expected) {
        throw new Error(`Mixed batch detail staging was incomplete for ${collection}.`);
    }
}

async function finalizeHeader(headerId: number, lockId: string, userId: number, now: string, effectiveAt: string) {
    const finalized = await patchFiltered(
        "price_change_headers",
        {
            _and: [
                { header_id: { _eq: headerId } },
                { status: { _eq: "PENDING" } },
                { application_status: { _eq: "APPLYING" } },
                { application_lock_id: { _eq: lockId } },
            ],
        },
        {
            status: "APPROVED",
            approved_by: userId,
            approved_at: now,
            effective_at: effectiveAt,
            application_status: "SCHEDULED",
            application_lock_id: null,
            application_started_at: null,
            application_attempts: 0,
            application_error: null,
            applied_at: null,
            applied_by: null,
        },
        "header_id,status,application_status,effective_at",
    );

    if (!finalized[0]) throw new Error("Mixed batch approval lock was lost before staging completed.");
}

async function refreshUnifiedApplicationStatus(headerId: number, userId: number | null) {
    const [priceRows, costRows] = await Promise.all([
        fetchApplicationRows(PRICE_DETAILS, headerId),
        fetchApplicationRows(COST_DETAILS, headerId),
    ]);
    const rows = [...priceRows, ...costRows];
    if (rows.length === 0) return null;

    const hasPendingRows = rows.some((row) => String(row.status ?? "") === "PENDING");
    const approvedRows = rows.filter((row) => String(row.status ?? "") === "APPROVED");
    const statuses = approvedRows.map((row) => String(row.application_status ?? "").toUpperCase());
    const status = hasPendingRows || statuses.includes("FAILED")
        ? "FAILED"
        : statuses.includes("APPLYING")
          ? "APPLYING"
          : statuses.includes("SCHEDULED")
            ? "SCHEDULED"
            : "APPLIED";
    const error = hasPendingRows
        ? "Batch has pending detail rows that were not staged for application."
        : rows.find((row) => String(row.application_status ?? "").toUpperCase() === "FAILED")?.application_error ?? null;
    const attempts = Math.max(...rows.map((row) => Number(row.application_attempts ?? 0)), 0);

    await patchFiltered(
        "price_change_headers",
        { _and: [{ header_id: { _eq: headerId } }] },
        {
            application_status: status,
            application_attempts: attempts,
            application_error: error,
            application_lock_id: null,
            application_started_at: null,
            ...(status === "APPLIED" ? { applied_at: nowManila(), ...(userId ? { applied_by: userId } : {}) } : {}),
        },
        "header_id,status,application_status,application_attempts,application_error",
    );

    return status;
}

export async function approveUnifiedBatch(headerId: number, userId: number, effectiveAt?: string | null) {
    const batch = await getUnifiedBatch(headerId);
    if (!batch) return { error: "Batch not found", status: 404 } as const;
    if (batch.status !== "PENDING") return { error: "Only PENDING batches can be approved.", status: 409 } as const;
    if (batch.price_details.length === 0 || batch.cost_details.length === 0) {
        return { error: "This batch is not a mixed batch.", status: 400 } as const;
    }

    for (const line of batch.price_details) {
        if (!line.product_id || !line.price_type_id || !isValidPriceValue(line.proposed_price)) {
            return { error: "Mixed batch contains an invalid price detail line.", status: 400 } as const;
        }
    }
    for (const line of batch.cost_details) {
        if (!line.product_id || !Number.isFinite(Number(line.proposed_cost))) {
            return { error: "Mixed batch contains an invalid list cost detail line.", status: 400 } as const;
        }
    }

    const conflicts = await findPriceSnapshotConflicts(
        batch.price_details.map((line) => ({
            request_id: line.request_id ?? undefined,
            product_id: line.product_id,
            price_type_id: line.price_type_id!,
            current_price: line.current_price,
        })),
    );
    if (conflicts.length > 0) {
        return {
            error: "Mixed batch contains prices that changed after submission.",
            status: 409,
            conflicts,
        } as const;
    }

    const claimed = await claimHeader(headerId);
    if (!claimed) return { error: "Batch approval was already claimed or is no longer pending.", status: 409 } as const;

    const scheduled = Boolean(effectiveAt && new Date(effectiveAt).getTime() > Date.now());
    const effective = effectiveAt || claimed.now;

    try {
        await stageDetails(PRICE_DETAILS, headerId, userId, claimed.now, effective, batch.price_details.length);
        await stageDetails(COST_DETAILS, headerId, userId, claimed.now, effective, batch.cost_details.length);
        await finalizeHeader(headerId, claimed.lockId, userId, claimed.now, effective);
    } catch (error: unknown) {
        await patchFiltered(
            "price_change_headers",
            { _and: [{ header_id: { _eq: headerId } }, { application_lock_id: { _eq: claimed.lockId } }] },
            { application_status: "FAILED", application_lock_id: null, application_started_at: null, application_error: error instanceof Error ? error.message : String(error) },
            "header_id,status,application_status,application_error",
        ).catch(() => undefined);
        const message = error instanceof Error ? error.message : String(error);
        return {
            error: message,
            status: message.includes("approval lock was lost") ? 409 : 500,
        } as const;
    }

    let applied = 0;
    let failed = 0;
    let warning: string | null = null;
    let retryable = false;
    if (!scheduled) {
        try {
            const [priceRows, costRows] = await Promise.all([
                fetchApplicationRows(PRICE_DETAILS, headerId),
                fetchApplicationRows(COST_DETAILS, headerId),
            ]);

            for (const row of priceRows) {
                const outcome = await executeClaimedApplication({
                    collection: PRICE_DETAILS,
                    row,
                    userId,
                    claimFields: ["current_price"],
                    apply: async (claimedRow) => {
                        await applyProposedPrice({
                            userId,
                            productId: detailProductId(claimedRow),
                            priceTypeId: detailPriceTypeId(claimedRow),
                            currentPrice: claimedRow.current_price,
                            proposedPrice: Number(claimedRow.proposed_price),
                        });
                    },
                });
                if (outcome.state === "applied") applied += 1;
                if (outcome.state === "failed") failed += 1;
            }

            for (const row of costRows) {
                const outcome = await executeClaimedApplication({
                    collection: COST_DETAILS,
                    row,
                    userId,
                    apply: async (claimedRow) => {
                        await patchProductCostField({
                            product_id: detailProductId(claimedRow),
                            proposed_cost: assertValidProposedCost(Number(claimedRow.proposed_cost)),
                            userId,
                        });
                    },
                });
                if (outcome.state === "applied") applied += 1;
                if (outcome.state === "failed") failed += 1;
            }
        } catch (error: unknown) {
            const notice = postCommitApplicationNotice(error, "pricing application");
            warning = notice.warning;
            retryable = notice.retryable;
        }
    }

    let applicationStatus: string | null = null;
    try {
        applicationStatus = await refreshUnifiedApplicationStatus(headerId, userId);
    } catch (error: unknown) {
        const notice = postCommitApplicationNotice(error, "application status reconciliation");
        warning = warning ?? notice.warning;
        retryable = notice.retryable;
    }
    if (failed > 0) {
        warning = warning ?? "Approval was saved, but one or more pricing lines failed to apply. Retry application from the batch details.";
        retryable = true;
    }

    const affected = batch.price_details.length + batch.cost_details.length;
    return {
        ok: true,
        committed: true,
        header_id: headerId,
        affected,
        applied,
        failed,
        scheduled,
        application_status: applicationStatus ?? fallbackApplicationStatus({ scheduled, applied, failed, affected }),
        effective_at: effective,
        warning,
        retryable,
    } as const;
}

export async function rejectUnifiedBatch(headerId: number, userId: number, reason: string) {
    const batch = await getUnifiedBatch(headerId);
    if (!batch) return { error: "Batch not found", status: 404 } as const;
    if (batch.status !== "PENDING") return { error: "Only PENDING batches can be rejected.", status: 409 } as const;
    if (batch.price_details.length === 0 || batch.cost_details.length === 0) {
        return { error: "This batch is not a mixed batch.", status: 400 } as const;
    }

    const claimed = await claimHeader(headerId);
    if (!claimed) return { error: "Batch rejection was already claimed or is no longer pending.", status: 409 } as const;

    try {
        const detailGroups = await Promise.all(
            [PRICE_DETAILS, COST_DETAILS].map(async (collection) => ({
                collection,
                rows: await fetchApplicationRows(collection, headerId),
            })),
        );

        for (const { collection, rows } of detailGroups) {
            const pendingRows = rows.filter((row) => String(row.status ?? "").toUpperCase() === "PENDING");
            if (pendingRows.length === 0) continue;

            const rejectedRows = await patchFiltered<DetailRow>(
                collection,
                { _and: [{ header_id: { _eq: headerId } }, { status: { _eq: "PENDING" } }] },
                {
                    status: "REJECTED",
                    rejected_by: userId,
                    rejected_at: claimed.now,
                    reject_reason: reason,
                    application_status: null,
                    application_lock_id: null,
                    application_started_at: null,
                    application_error: null,
                },
                "request_id,header_id,status",
            );
            if (rejectedRows.length !== pendingRows.length) {
                throw new Error(`Mixed batch rejection was incomplete for ${collection}.`);
            }
        }

        const [priceRows, costRows] = await Promise.all([
            fetchApplicationRows(PRICE_DETAILS, headerId),
            fetchApplicationRows(COST_DETAILS, headerId),
        ]);
        if ([...priceRows, ...costRows].some((row) => String(row.status ?? "").toUpperCase() !== "REJECTED")) {
            throw new Error("Mixed batch rejection left one or more detail lines unresolved.");
        }

        const finalized = await patchFiltered(
            "price_change_headers",
            {
                _and: [
                    { header_id: { _eq: headerId } },
                    { status: { _eq: "PENDING" } },
                    { application_status: { _eq: "APPLYING" } },
                    { application_lock_id: { _eq: claimed.lockId } },
                ],
            },
            {
                status: "REJECTED",
                rejected_by: userId,
                rejected_at: claimed.now,
                reject_reason: reason,
                application_status: null,
                application_lock_id: null,
                application_started_at: null,
                application_error: null,
            },
            "header_id,status",
        );
        if (!finalized[0]) throw new Error("Mixed batch rejection lock was lost before finalization.");

        return { ok: true, header_id: headerId, rejected: batch.price_details.length + batch.cost_details.length } as const;
    } catch (error: unknown) {
        await patchFiltered(
            "price_change_headers",
            {
                _and: [
                    { header_id: { _eq: headerId } },
                    { status: { _eq: "PENDING" } },
                    { application_status: { _eq: "APPLYING" } },
                    { application_lock_id: { _eq: claimed.lockId } },
                ],
            },
            {
                application_status: "FAILED",
                application_lock_id: null,
                application_started_at: null,
                application_error: error instanceof Error ? error.message : String(error),
            },
            "header_id,status,application_status,application_error",
        ).catch(() => undefined);

        const message = error instanceof Error ? error.message : String(error);
        return {
            error: message,
            status: message.includes("rejection lock was lost") ? 409 : 500,
        } as const;
    }
}
