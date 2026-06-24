import { NextRequest, NextResponse } from "next/server";

import { invalidateGroupIndexCacheOnCatalogChange } from "../../_productGroupIndexCache";
import {
    DETAILS as PRICE_DETAILS,
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
import {
    executeClaimedApplication,
    refreshBatchApplicationStatus,
    staleApplicationCutoff,
} from "../../_applicationEngine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DirectusList<T> = {
    data?: T[];
    meta?: { filter_count?: number | string } | null;
};

const DUE_PAGE_SIZE = 500;

type ApplyFailure = {
    request_id: number;
    message: string;
};

type ScheduledSummary = {
    scanned: number;
    applied: number;
    failed: number;
    skipped: number;
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
    const all: PcrRow[] = [];
    let offset = 0;

    while (true) {
        const params = new URLSearchParams();
        params.set("limit", String(DUE_PAGE_SIZE));
        params.set("offset", String(offset));
        params.set(
            "fields",
            [
                "request_id",
                "header_id",
                "product_id",
                "price_type_id",
                "current_price",
                "proposed_price",
                "status",
                "application_status",
                "effective_at",
                "application_lock_id",
                "application_started_at",
                "application_attempts",
                "application_error",
            ].join(","),
        );
        params.set("filter[_and][0][status][_eq]", "APPROVED");
        params.set("filter[_and][1][_or][0][_and][0][application_status][_eq]", "SCHEDULED");
        params.set("filter[_and][1][_or][0][_and][1][effective_at][_lte]", now);
        params.set("filter[_and][1][_or][1][_and][0][application_status][_eq]", "APPLYING");
        params.set("filter[_and][1][_or][1][_and][1][application_started_at][_lte]", staleApplicationCutoff());
        params.set("sort", "effective_at,request_id");

        const url = `${mustBase()}/items/${PRICE_DETAILS}?${params.toString()}`;
        const json = await fetchDirectus<DirectusList<PcrRow>>(url, { headers: directusHeaders() });
        const rows = json.data ?? [];
        all.push(...rows);

        if (rows.length < DUE_PAGE_SIZE) break;
        offset += DUE_PAGE_SIZE;
    }

    return all;
}

async function fetchDueCostRequests(now: string) {
    const all: CcrRow[] = [];
    let offset = 0;

    while (true) {
        const params = new URLSearchParams();
        params.set("limit", String(DUE_PAGE_SIZE));
        params.set("offset", String(offset));
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
                "application_lock_id",
                "application_started_at",
                "application_attempts",
                "application_error",
            ].join(","),
        );
        params.set("filter[_and][0][status][_eq]", "APPROVED");
        params.set("filter[_and][1][_or][0][_and][0][application_status][_eq]", "SCHEDULED");
        params.set("filter[_and][1][_or][0][_and][1][effective_at][_lte]", now);
        params.set("filter[_and][1][_or][1][_and][0][application_status][_eq]", "APPLYING");
        params.set("filter[_and][1][_or][1][_and][1][application_started_at][_lte]", staleApplicationCutoff());
        params.set("sort", "effective_at,request_id");

        const url = `${mustBase()}/items/${CCR}?${params.toString()}`;
        const json = await fetchDirectus<DirectusList<CcrRow>>(url, { headers: directusHeaders() });
        const rows = json.data ?? [];
        all.push(...rows);

        if (rows.length < DUE_PAGE_SIZE) break;
        offset += DUE_PAGE_SIZE;
    }

    return all;
}

async function applyDuePriceRequests(rows: PcrRow[], userId: number | null): Promise<ScheduledSummary> {
    const failures: ApplyFailure[] = [];
    const headerIds = new Set<number>();
    let applied = 0;
    let skipped = 0;

    for (const row of rows) {
        const requestId = pickId(row.request_id) ?? 0;
        const headerId = pickId(row.header_id);
        if (headerId) headerIds.add(headerId);
        const outcome = await executeClaimedApplication({
            collection: PRICE_DETAILS,
            row,
            userId,
            claimFields: ["current_price"],
            apply: async (claimed) => {
                const productId = normalizeProductId(claimed);
                const priceTypeId = normalizePriceTypeId(claimed);
                const proposedPrice = Number(claimed.proposed_price);
                if (!requestId || !productId || !priceTypeId || !Number.isFinite(proposedPrice)) {
                    throw new Error("Scheduled price request has invalid product, price type, or proposed price.");
                }
                await applyProposedPrice({
                    userId,
                    productId,
                    priceTypeId,
                    currentPrice: claimed.current_price,
                    proposedPrice,
                });
            },
        });
        if (outcome.state === "applied") {
            applied += 1;
        } else if (outcome.state === "failed") {
            failures.push({
                request_id: requestId,
                message: outcome.error ?? "Application failed.",
            });
        } else {
            skipped += 1;
        }
    }

    for (const headerId of headerIds) {
        await refreshBatchApplicationStatus({ detailCollection: PRICE_DETAILS, headerId, userId });
    }

    return { scanned: rows.length, applied, failed: failures.length, skipped, failures };
}

async function applyDueCostRequests(rows: CcrRow[], userId: number | null): Promise<ScheduledSummary> {
    const failures: ApplyFailure[] = [];
    const headerIds = new Set<number>();
    let applied = 0;
    let skipped = 0;

    for (const row of rows) {
        const requestId = pickId(row.request_id) ?? 0;
        const headerId = pickId(row.header_id);
        if (headerId) headerIds.add(headerId);
        const outcome = await executeClaimedApplication({
            collection: COST_DETAILS,
            row,
            userId,
            apply: async (claimed) => {
                const product_id = Number(claimed.product_id);
                const proposed_cost = Number(claimed.proposed_cost);
                if (!requestId || !Number.isFinite(product_id) || product_id <= 0 || !Number.isFinite(proposed_cost)) {
                    throw new Error("Scheduled cost request has invalid product or proposed cost.");
                }
                await patchProductCostField({ product_id, proposed_cost, userId });
            },
        });
        if (outcome.state === "applied") {
            applied += 1;
        } else if (outcome.state === "failed") {
            failures.push({
                request_id: requestId,
                message: outcome.error ?? "Application failed.",
            });
        } else {
            skipped += 1;
        }
    }

    for (const headerId of headerIds) {
        await refreshBatchApplicationStatus({ detailCollection: COST_DETAILS, headerId, userId });
    }

    return { scanned: rows.length, applied, failed: failures.length, skipped, failures };
}

export async function POST(req: NextRequest) {
    try {
        const tokenError = assertSchedulerToken(req);
        if (tokenError) return tokenError;

        const now = nowManila();
        const userId = schedulerUserId();
        const [priceRows, costRows] = await Promise.all([fetchDuePriceRequests(now), fetchDueCostRequests(now)]);
        const [price, cost] = await Promise.all([
            applyDuePriceRequests(priceRows, userId),
            applyDueCostRequests(costRows, userId),
        ]);

        if (price.applied > 0 || cost.applied > 0) {
            invalidateGroupIndexCacheOnCatalogChange();
        }

        return NextResponse.json({ ok: true, ran_at: now, price, cost });
    } catch (error: unknown) {
        return directusErrorResponse(error);
    }
}
