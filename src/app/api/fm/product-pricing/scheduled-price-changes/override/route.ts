import { NextRequest, NextResponse } from "next/server";

import {
    DETAILS as PRICE_DETAILS,
    HEADERS,
    decodeUserIdFromJwtCookie,
    directusErrorResponse,
    directusHeaders,
    fetchDirectus,
    getDetails,
    getHeader,
    mustBase,
    nowManila,
    pickId,
} from "../../price-change-batches/_batch";
import {
    applyProposedPrice,
    getPriceRequest,
} from "../../price-change-requests/_actions";
import {
    CCR,
    getCostRequest,
    patchProductCostField,
} from "../../cost-change-requests/_actions";
import {
    COST_DETAILS,
    getCostDetails,
    getCostHeader,
} from "../../cost-change-batches/_batch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OverrideKind = "price_request" | "price_batch" | "cost_request" | "cost_batch";
type OverrideAction = "reschedule" | "apply_now" | "cancel_schedule" | "reject_schedule";

type OverrideBody = Partial<{
    kind: OverrideKind;
    id: number;
    action: OverrideAction;
    effective_at: string | null;
    reject_reason: string | null;
}>;

type ScheduledPriceRow = {
    request_id?: unknown;
    product_id?: unknown;
    price_type_id?: unknown;
    proposed_price?: unknown;
};

type ScheduledCostRow = {
    request_id?: unknown;
    product_id?: unknown;
    proposed_cost?: unknown;
};

function assertFutureDate(value?: string | null) {
    if (!value) throw new Error("effective_at is required.");
    const time = new Date(value).getTime();
    if (!Number.isFinite(time) || time <= Date.now()) {
        throw new Error("effective_at must be a valid future date/time.");
    }
}

function isScheduledApproved(row: { status?: string | null; application_status?: string | null } | null) {
    return String(row?.status ?? "") === "APPROVED" && String(row?.application_status ?? "") === "SCHEDULED";
}

function isFutureScheduledApproved(
    row: { status?: string | null; application_status?: string | null; effective_at?: string | null } | null,
) {
    if (!isScheduledApproved(row)) return false;
    const time = new Date(row?.effective_at ?? "").getTime();
    return Number.isFinite(time) && time > Date.now();
}

function requireRejectReason(value?: string | null) {
    const reason = String(value ?? "").trim();
    if (!reason) throw new Error("reject_reason is required.");
    return reason;
}

async function patchRows(collection: string, ids: number[], patch: Record<string, unknown>) {
    await Promise.all(
        ids
            .filter((id) => id > 0)
            .map((id) =>
                fetchDirectus(`${mustBase()}/items/${collection}/${id}`, {
                    method: "PATCH",
                    headers: directusHeaders(),
                    body: JSON.stringify(patch),
                }),
            ),
    );
}

async function rescheduleRequest(collection: string, id: number, effectiveAt?: string | null) {
    assertFutureDate(effectiveAt);
    await patchRows(collection, [id], { effective_at: effectiveAt, application_status: "SCHEDULED" });
}

async function cancelScheduledRequest(collection: string, id: number) {
    await patchRows(collection, [id], { application_status: "CANCELLED" });
}

async function rejectScheduledRequest(collection: string, id: number, userId: number, rejectReason: string) {
    await patchRows(collection, [id], {
        status: "REJECTED",
        application_status: "CANCELLED",
        rejected_by: userId,
        rejected_at: nowManila(),
        reject_reason: rejectReason,
    });
}

async function applyPriceRequestNow(row: ScheduledPriceRow, userId: number) {
    const requestId = pickId(row.request_id) ?? 0;
    const productId = pickId(row.product_id) ?? 0;
    const priceTypeId = pickId(row.price_type_id) ?? 0;
    const proposedPrice = Number(row.proposed_price);
    if (!requestId || !productId || !priceTypeId || !Number.isFinite(proposedPrice)) {
        throw new Error("Scheduled price request has invalid product, price type, or proposed price.");
    }

    const now = nowManila();
    await applyProposedPrice({ userId, productId, priceTypeId, proposedPrice });
    await patchRows(PRICE_DETAILS, [requestId], {
        application_status: "APPLIED",
        applied_at: now,
        applied_by: userId,
        effective_at: now,
    });
}

async function applyCostRequestNow(row: ScheduledCostRow, userId: number) {
    const requestId = pickId(row.request_id) ?? 0;
    const product_id = pickId(row.product_id) ?? 0;
    const proposed_cost = Number(row.proposed_cost);
    if (!requestId || !Number.isFinite(product_id) || product_id <= 0 || !Number.isFinite(proposed_cost)) {
        throw new Error("Scheduled cost request has invalid product or proposed cost.");
    }

    const now = nowManila();
    await patchProductCostField({ product_id, proposed_cost, userId });
    await patchRows(CCR, [requestId], {
        application_status: "APPLIED",
        applied_at: now,
        applied_by: userId,
        effective_at: now,
    });
}

async function applyPriceBatchNow(headerId: number, userId: number) {
    const details = await getDetails(headerId);
    const scheduledDetails = details.filter(isScheduledApproved);
    for (const row of scheduledDetails) {
        await applyPriceRequestNow(row, userId);
    }

    const now = nowManila();
    await patchRows(HEADERS, [headerId], {
        application_status: "APPLIED",
        applied_at: now,
        applied_by: userId,
        effective_at: now,
    });

    return scheduledDetails.length;
}

async function applyCostBatchNow(headerId: number, userId: number) {
    const details = await getCostDetails(headerId);
    const scheduledDetails = details.filter(isScheduledApproved);
    for (const row of scheduledDetails) {
        await applyCostRequestNow(row, userId);
    }

    const now = nowManila();
    await patchRows(HEADERS, [headerId], {
        application_status: "APPLIED",
        applied_at: now,
        applied_by: userId,
        effective_at: now,
    });

    return scheduledDetails.length;
}

async function patchBatchSchedule(collection: string, headerId: number, patch: Record<string, unknown>) {
    const detailRows = collection === PRICE_DETAILS ? await getDetails(headerId) : await getCostDetails(headerId);
    const ids = detailRows.map((row) => pickId(row.request_id)).filter((id): id is number => Boolean(id));
    await patchRows(HEADERS, [headerId], patch);
    await patchRows(collection, ids, patch);
    return ids.length;
}

async function rejectScheduledBatch(collection: string, headerId: number, userId: number, rejectReason: string) {
    const now = nowManila();
    return patchBatchSchedule(collection, headerId, {
        status: "REJECTED",
        application_status: "CANCELLED",
        rejected_by: userId,
        rejected_at: now,
        reject_reason: rejectReason,
    });
}

export async function POST(req: NextRequest) {
    try {
        const userId = decodeUserIdFromJwtCookie(req);
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const body = (await req.json().catch(() => ({}))) as OverrideBody;
        const kind = body.kind;
        const action = body.action;
        const id = Number(body.id);

        if (!kind || !["price_request", "price_batch", "cost_request", "cost_batch"].includes(kind)) {
            return NextResponse.json({ error: "Unsupported kind" }, { status: 400 });
        }
        if (!action || !["reschedule", "apply_now", "cancel_schedule", "reject_schedule"].includes(action)) {
            return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
        }
        if (!Number.isFinite(id) || id <= 0) {
            return NextResponse.json({ error: "id is required" }, { status: 400 });
        }

        if (kind === "price_request") {
            const row = await getPriceRequest(id);
            if (!row || !isFutureScheduledApproved(row)) {
                return NextResponse.json({ error: "Only scheduled approved price requests can be overridden." }, { status: 400 });
            }
            if (action === "reschedule") await rescheduleRequest(PRICE_DETAILS, id, body.effective_at);
            if (action === "cancel_schedule") await cancelScheduledRequest(PRICE_DETAILS, id);
            if (action === "reject_schedule") await rejectScheduledRequest(PRICE_DETAILS, id, userId, requireRejectReason(body.reject_reason));
            if (action === "apply_now") await applyPriceRequestNow(row, userId);
            return NextResponse.json({ ok: true, kind, action, id });
        }

        if (kind === "cost_request") {
            const row = await getCostRequest(id);
            if (!row || !isFutureScheduledApproved(row)) {
                return NextResponse.json({ error: "Only scheduled approved cost requests can be overridden." }, { status: 400 });
            }
            if (action === "reschedule") await rescheduleRequest(CCR, id, body.effective_at);
            if (action === "cancel_schedule") await cancelScheduledRequest(CCR, id);
            if (action === "reject_schedule") await rejectScheduledRequest(CCR, id, userId, requireRejectReason(body.reject_reason));
            if (action === "apply_now") await applyCostRequestNow(row, userId);
            return NextResponse.json({ ok: true, kind, action, id });
        }

        if (kind === "price_batch") {
            const header = await getHeader(id);
            if (!isFutureScheduledApproved(header)) {
                return NextResponse.json({ error: "Only scheduled approved price batches can be overridden." }, { status: 400 });
            }
            if (action === "reschedule") {
                assertFutureDate(body.effective_at);
                const affected = await patchBatchSchedule(PRICE_DETAILS, id, {
                    effective_at: body.effective_at,
                    application_status: "SCHEDULED",
                });
                return NextResponse.json({ ok: true, kind, action, id, affected });
            }
            if (action === "cancel_schedule") {
                const affected = await patchBatchSchedule(PRICE_DETAILS, id, { application_status: "CANCELLED" });
                return NextResponse.json({ ok: true, kind, action, id, affected });
            }
            if (action === "reject_schedule") {
                const affected = await rejectScheduledBatch(PRICE_DETAILS, id, userId, requireRejectReason(body.reject_reason));
                return NextResponse.json({ ok: true, kind, action, id, affected });
            }
            const affected = await applyPriceBatchNow(id, userId);
            return NextResponse.json({ ok: true, kind, action, id, affected });
        }

        const header = await getCostHeader(id);
        if (!isFutureScheduledApproved(header)) {
            return NextResponse.json({ error: "Only scheduled approved cost batches can be overridden." }, { status: 400 });
        }
        if (action === "reschedule") {
            assertFutureDate(body.effective_at);
            const affected = await patchBatchSchedule(COST_DETAILS, id, {
                effective_at: body.effective_at,
                application_status: "SCHEDULED",
            });
            return NextResponse.json({ ok: true, kind, action, id, affected });
        }
        if (action === "cancel_schedule") {
            const affected = await patchBatchSchedule(COST_DETAILS, id, { application_status: "CANCELLED" });
            return NextResponse.json({ ok: true, kind, action, id, affected });
        }
        if (action === "reject_schedule") {
            const affected = await rejectScheduledBatch(COST_DETAILS, id, userId, requireRejectReason(body.reject_reason));
            return NextResponse.json({ ok: true, kind, action, id, affected });
        }
        const affected = await applyCostBatchNow(id, userId);
        return NextResponse.json({ ok: true, kind, action, id, affected });
    } catch (error: unknown) {
        if (error instanceof Error && (error.message.includes("effective_at") || error.message.includes("reject_reason"))) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        return directusErrorResponse(error);
    }
}
