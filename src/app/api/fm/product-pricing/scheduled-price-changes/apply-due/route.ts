import { NextRequest, NextResponse } from "next/server";

import { invalidateGroupIndexCacheOnCatalogChange } from "../../_productGroupIndexCache";
import {
    DETAILS as PRICE_DETAILS,
    HEADERS,
    directusErrorResponse,
    directusHeaders,
    fetchDirectus,
    mustBase,
    normalizePriceTypeId,
    normalizeProductId,
    nowManila,
    pickId,
} from "../../price-change-batches/_batch";
import {
    applyProposedPrice,
    type PcrRow,
} from "../../price-change-requests/_actions";
import {
    CCR,
    patchProductCostField,
    type CcrRow,
} from "../../cost-change-requests/_actions";
import { COST_DETAILS } from "../../cost-change-batches/_batch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DirectusList<T> = { data?: T[] };

type ApplyFailure = {
    request_id: number;
    message: string;
};

type ScheduledSummary = {
    scanned: number;
    applied: number;
    failed: number;
    failures: ApplyFailure[];
};

function schedulerToken() {
    return String(process.env.PRICE_CHANGE_SCHEDULER_TOKEN ?? "").trim();
}

function schedulerUserId() {
    const value = Number(process.env.PRICE_CHANGE_SCHEDULER_USER_ID);
    return Number.isFinite(value) && value > 0 ? value : null;
}

function assertSchedulerToken(req: NextRequest) {
    const expected = schedulerToken();
    if (!expected) {
        return NextResponse.json(
            { error: "PRICE_CHANGE_SCHEDULER_TOKEN is not configured." },
            { status: 500 },
        );
    }

    const actual = String(req.headers.get("x-scheduler-token") ?? "").trim();
    if (actual !== expected) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return null;
}

async function fetchDuePriceRequests(now: string) {
    const params = new URLSearchParams();
    params.set("limit", "-1");
    params.set(
        "fields",
        [
            "request_id",
            "header_id",
            "product_id",
            "price_type_id",
            "proposed_price",
            "status",
            "application_status",
            "effective_at",
        ].join(","),
    );
    params.set("filter[status][_eq]", "APPROVED");
    params.set("filter[application_status][_eq]", "SCHEDULED");
    params.set("filter[effective_at][_lte]", now);
    params.set("sort", "effective_at,request_id");

    const url = `${mustBase()}/items/${PRICE_DETAILS}?${params.toString()}`;
    const json = await fetchDirectus<DirectusList<PcrRow>>(url, { headers: directusHeaders() });
    return json.data ?? [];
}

async function fetchDueCostRequests(now: string) {
    const params = new URLSearchParams();
    params.set("limit", "-1");
    params.set(
        "fields",
        [
            "request_id",
            "header_id",
            "product_id",
            "proposed_cost",
            "status",
            "application_status",
            "effective_at",
        ].join(","),
    );
    params.set("filter[status][_eq]", "APPROVED");
    params.set("filter[application_status][_eq]", "SCHEDULED");
    params.set("filter[effective_at][_lte]", now);
    params.set("sort", "effective_at,request_id");

    const url = `${mustBase()}/items/${CCR}?${params.toString()}`;
    const json = await fetchDirectus<DirectusList<CcrRow>>(url, { headers: directusHeaders() });
    return json.data ?? [];
}

async function scheduledDetailCount(collection: string, headerId: number) {
    const params = new URLSearchParams();
    params.set("limit", "1");
    params.set("aggregate[count]", "*");
    params.set("filter[header_id][_eq]", String(headerId));
    params.set("filter[status][_eq]", "APPROVED");
    params.set("filter[application_status][_eq]", "SCHEDULED");

    const url = `${mustBase()}/items/${collection}?${params.toString()}`;
    const json = await fetchDirectus<DirectusList<{ count?: { "*"?: number | string } }>>(url, {
        headers: directusHeaders(),
    });
    const count = Number(json.data?.[0]?.count?.["*"] ?? 0);
    return Number.isFinite(count) ? count : 0;
}

async function markHeaderAppliedIfDone(collection: string, headerId: number, appliedAt: string, userId: number | null) {
    if (headerId <= 0) return;
    const remaining = await scheduledDetailCount(collection, headerId);
    if (remaining > 0) return;

    await fetchDirectus(`${mustBase()}/items/${HEADERS}/${headerId}`, {
        method: "PATCH",
        headers: directusHeaders(),
        body: JSON.stringify({
            application_status: "APPLIED",
            applied_at: appliedAt,
            ...(userId ? { applied_by: userId } : {}),
        }),
    });
}

async function applyDuePriceRequests(rows: PcrRow[], appliedAt: string, userId: number | null): Promise<ScheduledSummary> {
    const failures: ApplyFailure[] = [];
    const headerIds = new Set<number>();
    let applied = 0;

    for (const row of rows) {
        const requestId = pickId(row.request_id) ?? 0;
        try {
            const productId = normalizeProductId(row);
            const priceTypeId = normalizePriceTypeId(row);
            const proposedPrice = Number(row.proposed_price);
            if (!requestId || !productId || !priceTypeId || !Number.isFinite(proposedPrice)) {
                throw new Error("Scheduled price request has invalid product, price type, or proposed price.");
            }

            await applyProposedPrice({ userId, productId, priceTypeId, proposedPrice });
            await fetchDirectus(`${mustBase()}/items/${PRICE_DETAILS}/${requestId}`, {
                method: "PATCH",
                headers: directusHeaders(),
                body: JSON.stringify({
                    application_status: "APPLIED",
                    applied_at: appliedAt,
                    ...(userId ? { applied_by: userId } : {}),
                }),
            });

            const headerId = pickId(row.header_id);
            if (headerId) headerIds.add(headerId);
            applied += 1;
        } catch (error: unknown) {
            failures.push({
                request_id: requestId,
                message: error instanceof Error ? error.message : String(error),
            });
        }
    }

    for (const headerId of headerIds) {
        await markHeaderAppliedIfDone(PRICE_DETAILS, headerId, appliedAt, userId);
    }

    return { scanned: rows.length, applied, failed: failures.length, failures };
}

async function applyDueCostRequests(rows: CcrRow[], appliedAt: string, userId: number | null): Promise<ScheduledSummary> {
    const failures: ApplyFailure[] = [];
    const headerIds = new Set<number>();
    let applied = 0;

    for (const row of rows) {
        const requestId = pickId(row.request_id) ?? 0;
        try {
            const product_id = Number(row.product_id);
            const proposed_cost = Number(row.proposed_cost);
            if (!requestId || !Number.isFinite(product_id) || product_id <= 0 || !Number.isFinite(proposed_cost)) {
                throw new Error("Scheduled cost request has invalid product or proposed cost.");
            }

            await patchProductCostField({ product_id, proposed_cost, userId });
            await fetchDirectus(`${mustBase()}/items/${COST_DETAILS}/${requestId}`, {
                method: "PATCH",
                headers: directusHeaders(),
                body: JSON.stringify({
                    application_status: "APPLIED",
                    applied_at: appliedAt,
                    ...(userId ? { applied_by: userId } : {}),
                }),
            });

            const headerId = pickId(row.header_id);
            if (headerId) headerIds.add(headerId);
            applied += 1;
        } catch (error: unknown) {
            failures.push({
                request_id: requestId,
                message: error instanceof Error ? error.message : String(error),
            });
        }
    }

    for (const headerId of headerIds) {
        await markHeaderAppliedIfDone(COST_DETAILS, headerId, appliedAt, userId);
    }

    return { scanned: rows.length, applied, failed: failures.length, failures };
}

export async function POST(req: NextRequest) {
    try {
        const tokenError = assertSchedulerToken(req);
        if (tokenError) return tokenError;

        const now = nowManila();
        const userId = schedulerUserId();
        const [priceRows, costRows] = await Promise.all([fetchDuePriceRequests(now), fetchDueCostRequests(now)]);
        const [price, cost] = await Promise.all([
            applyDuePriceRequests(priceRows, now, userId),
            applyDueCostRequests(costRows, now, userId),
        ]);

        if (price.applied > 0 || cost.applied > 0) {
            invalidateGroupIndexCacheOnCatalogChange();
        }

        return NextResponse.json({ ok: true, ran_at: now, price, cost });
    } catch (error: unknown) {
        return directusErrorResponse(error);
    }
}
