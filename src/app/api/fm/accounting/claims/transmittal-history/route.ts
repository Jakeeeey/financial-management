// src/app/api/fm/claims/transmittal-history/route.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const DIRECTUS_STATIC_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

type DirectusErrorShape = { __directus_error__: true; status: number; body: unknown };
type DirectusOk<T> = T;

type DirectusListResponse<T> = { data?: T[]; meta?: { filter_count?: number } };
type DirectusDetailAggRow = {
    id?: number | string | null;
    claims_transmittal_id?: number | string | null;
    amount?: number | string | null;
    received_at?: string | null;
    remarks?: string | null;
    customer_memo_id?:
        | number
        | string
        | null
        | {
        id?: number | string | null;
        memo_number?: string | null;
        reason?: string | null;
        amount?: number | string | null;
    };
};

type DirectusRepresentativeRow = {
    id?: number | string | null;
    first_name?: string | null;
    middle_name?: string | null;
    last_name?: string | null;
    suffix?: string | null;
};

type DirectusSupplierRel = {
    id?: number | string | null;
    supplier_name?: string | null;
    supplier_shortcut?: string | null;
};

type DirectusTransmittalRow = {
    id?: number | string | null;
    transmittal_no?: string | null;
    supplier_id?: number | string | null | DirectusSupplierRel;
    supplier_representative_id?: number | string | null;
    total_amount?: number | string | null;
    status?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
};

type DirectusCCMClaimRow = {
    id?: number | string | null;
    isClaimed?: unknown;
};

type HistoryDetail = {
    id: number | null;
    customer_memo_id: number | null;
    memo_number: string;
    reason: string | null;
    amount: number;
    received_at: string | null;
    remarks: string | null;
};

type HistoryHeader = {
    id: number | null;
    transmittal_no: string | null;

    supplier_id: number | null;
    supplier_name: string;
    supplier_shortcut: string | null;

    supplier_representative_id: number | null;
    representative_name: string;

    created_at: string | null;
    updated_at: string | null;
    status: string;

    total_amount: number;
    ccm_count: number;
    details: HistoryDetail[];
};

function authHeaders(req: NextRequest): Record<string, string> {
    const cookieToken = req.cookies.get("vos_access_token")?.value;
    const token = DIRECTUS_STATIC_TOKEN || cookieToken;

    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (token) h.Authorization = `Bearer ${token}`;
    return h;
}

async function directus<T>(
    req: NextRequest,
    path: string
): Promise<DirectusOk<T> | DirectusErrorShape> {
    if (!DIRECTUS_URL) throw new Error("NEXT_PUBLIC_API_BASE_URL is not configured");

    const r = await fetch(`${DIRECTUS_URL}${path}`, {
        headers: authHeaders(req),
        cache: "no-store",
    });

    const jsonUnknown: unknown = await r.json().catch(() => ({} as unknown));
    if (!r.ok) {
        return { __directus_error__: true, status: r.status, body: jsonUnknown };
    }
    return jsonUnknown as T;
}

function safeStr(v: unknown): string {
    return typeof v === "string" ? v : v == null ? "" : String(v);
}

function safeNum(v: unknown, fallback = 0): number {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : fallback;
}

function toPosInt(v: unknown): number | null {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

function joinName(parts: Array<unknown>): string {
    return parts
        .map((p) => (typeof p === "string" ? p.trim() : ""))
        .filter(Boolean)
        .join(" ")
        .trim();
}

function normalizeStatus(v: unknown): string {
    return safeStr(v).trim().toUpperCase();
}

/**
 * Handles BIT(1)/boolean-ish values from Directus.
 */
function isTruthyBit(v: unknown): boolean {
    if (v === true) return true;
    if (v === false) return false;
    if (typeof v === "number") return v === 1;

    if (typeof v === "string") {
        const s = v.trim().toLowerCase();
        return s === "1" || s === "true" || s === "yes";
    }

    if (v && typeof v === "object") {
        // Possible Buffer-like JSON: { type: "Buffer", data: [0|1] }
        if ("type" in v && "data" in v) {
            const vv = v as { type?: unknown; data?: unknown };
            if (vv.type === "Buffer" && Array.isArray(vv.data)) {
                const first = vv.data[0];
                return first === 1;
            }
        }
        // Some adapters might return [0|1]
        if (Array.isArray(v)) {
            return v[0] === 1;
        }
    }

    return false;
}

const REPRESENTATIVES = "suppliers_representative";

async function fetchIsClaimedMap(
    req: NextRequest,
    memoIds: number[]
): Promise<Map<number, boolean>> {
    const uniq = Array.from(new Set(memoIds)).filter((n) => Number.isFinite(n) && n > 0);
    const map = new Map<number, boolean>();
    if (!uniq.length) return map;

    const qs = new URLSearchParams();
    qs.set("limit", String(Math.max(200, uniq.length)));
    qs.set("fields", "id,isClaimed");
    qs.set("filter[id][_in]", uniq.join(","));

    const raw = await directus<DirectusListResponse<DirectusCCMClaimRow>>(
        req,
        `/items/customers_memo?${qs.toString()}`
    );
    if ((raw as DirectusErrorShape).__directus_error__) return map;

    const rows = Array.isArray((raw as DirectusListResponse<DirectusCCMClaimRow>).data)
        ? ((raw as DirectusListResponse<DirectusCCMClaimRow>).data as DirectusCCMClaimRow[])
        : [];

    for (const r of rows) {
        const id = toPosInt(r?.id);
        if (!id) continue;
        map.set(id, isTruthyBit(r?.isClaimed));
    }

    return map;
}

// GET /api/fm/claims/transmittal-history?q=&status=&date_from=&date_to=&page=&limit=
export async function GET(req: NextRequest) {
    try {
        const url = new URL(req.url);

        const q = (url.searchParams.get("q") ?? "").trim();
        const statusRaw = (url.searchParams.get("status") ?? "").trim();
        const dateFrom = (url.searchParams.get("date_from") ?? "").trim();
        const dateTo = (url.searchParams.get("date_to") ?? "").trim();

        const page = Math.max(1, safeNum(url.searchParams.get("page") ?? 1, 1));
        const limit = Math.min(100, Math.max(10, safeNum(url.searchParams.get("limit") ?? 25, 25)));
        const offset = (page - 1) * limit;

        const TRANSMITTAL = "claims_transmittal";

        // Build Directus filter WITHOUT any
        const and: Array<Record<string, unknown>> = [];
        const filter: Record<string, unknown> = {};

        if (statusRaw) {
            const statuses = statusRaw
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);

            if (statuses.length === 1) {
                and.push({ status: { _eq: statuses[0] } });
            } else if (statuses.length > 1) {
                and.push({ status: { _in: statuses } });
            }
        }

        if (dateFrom) and.push({ created_at: { _gte: dateFrom } });
        if (dateTo) and.push({ created_at: { _lte: dateTo } });

        if (q) {
            and.push({
                _or: [
                    { transmittal_no: { _contains: q } },
                    { supplier_id: { supplier_name: { _contains: q } } },
                ],
            });
        }

        if (and.length) filter._and = and;

        const transmittalFields = [
            "id",
            "transmittal_no",
            "supplier_id.id",
            "supplier_id.supplier_name",
            "supplier_id.supplier_shortcut",
            "supplier_representative_id",
            "total_amount",
            "status",
            "created_at",
            "updated_at",
        ].join(",");

        const qs1 = new URLSearchParams();
        if (Object.keys(filter).length) qs1.set("filter", JSON.stringify(filter));
        qs1.set("fields", transmittalFields);
        qs1.set("sort", "-created_at");
        qs1.set("limit", String(limit));
        qs1.set("offset", String(offset));
        qs1.set("meta", "filter_count");

        const raw1 = await directus<DirectusListResponse<DirectusTransmittalRow>>(
            req,
            `/items/${TRANSMITTAL}?${qs1.toString()}`
        );
        if ((raw1 as DirectusErrorShape).__directus_error__) {
            const err = raw1 as DirectusErrorShape;
            return NextResponse.json(
                { error: "Directus request failed", details: err.body },
                { status: err.status || 500 }
            );
        }

        const headers = Array.isArray((raw1 as DirectusListResponse<DirectusTransmittalRow>).data)
            ? ((raw1 as DirectusListResponse<DirectusTransmittalRow>).data as DirectusTransmittalRow[])
            : [];
        const meta = (raw1 as DirectusListResponse<DirectusTransmittalRow>).meta ?? null;
        const total = safeNum(meta?.filter_count ?? 0, 0);

        const ids = headers.map((t) => toPosInt(t?.id)).filter((x): x is number => x != null);

        if (!ids.length) {
            return NextResponse.json({ data: [], meta, total, page, pageSize: limit }, { status: 200 });
        }

        // Representatives lookup
        const repIds = Array.from(
            new Set(headers.map((t) => toPosInt(t?.supplier_representative_id)).filter((x): x is number => x != null))
        );

        const repsById = new Map<number, { id: number; full_name: string }>();

        if (repIds.length) {
            const repFilter: Record<string, unknown> = { id: { _in: repIds } };
            const repFields = ["id", "first_name", "middle_name", "last_name", "suffix"].join(",");

            const qsRep = new URLSearchParams();
            qsRep.set("filter", JSON.stringify(repFilter));
            qsRep.set("fields", repFields);
            qsRep.set("limit", "10000");

            const rawRep = await directus<DirectusListResponse<DirectusRepresentativeRow>>(
                req,
                `/items/${REPRESENTATIVES}?${qsRep.toString()}`
            );
            if ((rawRep as DirectusErrorShape).__directus_error__) {
                const err = rawRep as DirectusErrorShape;
                return NextResponse.json(
                    { error: "Directus request failed", details: err.body },
                    { status: err.status || 500 }
                );
            }

            const reps = Array.isArray((rawRep as DirectusListResponse<DirectusRepresentativeRow>).data)
                ? ((rawRep as DirectusListResponse<DirectusRepresentativeRow>).data as DirectusRepresentativeRow[])
                : [];

            for (const r of reps) {
                const id = toPosInt(r?.id);
                if (!id) continue;
                const fullName = joinName([r?.first_name, r?.middle_name, r?.last_name, r?.suffix]);
                repsById.set(id, { id, full_name: fullName || `Representative #${id}` });
            }
        }

        // Details lookup
        const DETAILS = "claims_transmittal_details";
        const detailsFilter: Record<string, unknown> = { claims_transmittal_id: { _in: ids } };

        const detailFields = [
            "id",
            "claims_transmittal_id",
            "amount",
            "received_at",
            "remarks",
            "customer_memo_id.id",
            "customer_memo_id.memo_number",
            "customer_memo_id.reason",
            "customer_memo_id.amount",
        ].join(",");

        const qs2 = new URLSearchParams();
        qs2.set("filter", JSON.stringify(detailsFilter));
        qs2.set("fields", detailFields);
        qs2.set("limit", "10000");
        qs2.set("sort", "id");

        const raw2 = await directus<DirectusListResponse<DirectusDetailAggRow>>(
            req,
            `/items/${DETAILS}?${qs2.toString()}`
        );
        if ((raw2 as DirectusErrorShape).__directus_error__) {
            const err = raw2 as DirectusErrorShape;
            return NextResponse.json(
                { error: "Directus request failed", details: err.body },
                { status: err.status || 500 }
            );
        }

        const detailsRows = Array.isArray((raw2 as DirectusListResponse<DirectusDetailAggRow>).data)
            ? ((raw2 as DirectusListResponse<DirectusDetailAggRow>).data as DirectusDetailAggRow[])
            : [];

        const memoIds: number[] = [];
        for (const d of detailsRows) {
            const memoObj = d?.customer_memo_id;
            const memoId =
                memoObj && typeof memoObj === "object"
                    ? toPosInt((memoObj as { id?: unknown }).id)
                    : toPosInt(d?.customer_memo_id);
            if (memoId) memoIds.push(memoId);
        }

        const isClaimedMap = await fetchIsClaimedMap(req, memoIds);

        const byTrnId = new Map<number, DirectusDetailAggRow[]>();
        for (const d of detailsRows) {
            const trnId = toPosInt(d?.claims_transmittal_id);
            if (!trnId) continue;
            const arr = byTrnId.get(trnId) ?? [];
            arr.push(d);
            byTrnId.set(trnId, arr);
        }

        const normalized: HistoryHeader[] = headers.map((t) => {
            const tId = toPosInt(t?.id);

            const supplierObj = t?.supplier_id;
            const supplierRel =
                supplierObj && typeof supplierObj === "object"
                    ? (supplierObj as DirectusSupplierRel)
                    : null;

            const supplierId =
                supplierRel?.id != null ? toPosInt(supplierRel.id) : toPosInt(t?.supplier_id);

            const supplierName =
                safeStr(supplierRel?.supplier_name) ||
                (supplierId ? `Supplier #${supplierId}` : "—");

            const supplierShortcut = supplierRel?.supplier_shortcut ?? null;

            const repId = toPosInt(t?.supplier_representative_id);
            const representativeName = repId
                ? repsById.get(repId)?.full_name ?? `Representative #${repId}`
                : "—";

            const statusNorm = normalizeStatus(t?.status);

            let details: Array<HistoryDetail & { __isClaimed: boolean }> = (tId
                    ? byTrnId.get(tId) ?? []
                    : []
            ).map((d) => {
                const memo = d?.customer_memo_id;
                const memoObj = memo && typeof memo === "object" ? memo : null;

                const memoId =
                    memoObj && typeof memoObj === "object"
                        ? toPosInt((memoObj as { id?: unknown }).id)
                        : toPosInt(d?.customer_memo_id);

                const claimed = memoId ? isClaimedMap.get(memoId) ?? false : false;

                return {
                    id: toPosInt(d?.id),
                    customer_memo_id: memoId,
                    memo_number:
                        memoObj && typeof memoObj === "object"
                            ? safeStr((memoObj as { memo_number?: unknown }).memo_number).trim() || "—"
                            : "—",
                    reason:
                        memoObj && typeof memoObj === "object"
                            ? ((memoObj as { reason?: string | null }).reason ?? null)
                            : null,
                    amount: safeNum(d?.amount ?? (memoObj as { amount?: unknown } | null)?.amount ?? 0, 0),
                    received_at: d?.received_at ?? null,
                    remarks: d?.remarks ?? null,
                    __isClaimed: claimed,
                };
            });

            if (statusNorm === "POSTED") {
                details = details.filter((x) => x.__isClaimed);
            }

            const cleanedDetails: HistoryDetail[] = details.map((d) => {
                // omit __isClaimed without binding an unused variable
                const rest: HistoryDetail = {
                    id: d.id,
                    customer_memo_id: d.customer_memo_id,
                    memo_number: d.memo_number,
                    reason: d.reason,
                    amount: d.amount,
                    received_at: d.received_at,
                    remarks: d.remarks,
                };
                return rest;
            });
            const headerTotal = safeNum(t?.total_amount, Number.NaN);
            const finalTotal = Number.isFinite(headerTotal)
                ? headerTotal
                : cleanedDetails.reduce((sum, x) => sum + safeNum(x.amount, 0), 0);

            return {
                id: tId,
                transmittal_no: t?.transmittal_no ?? null,

                supplier_id: supplierId,
                supplier_name: supplierName,
                supplier_shortcut: supplierShortcut,

                supplier_representative_id: repId,
                representative_name: representativeName,

                created_at: t?.created_at ?? null,
                updated_at: t?.updated_at ?? null,
                status: safeStr(t?.status).trim() || "—",

                total_amount: finalTotal,
                ccm_count: cleanedDetails.length,
                details: cleanedDetails,
            };
        });

        return NextResponse.json({ data: normalized, meta, total, page, pageSize: limit }, { status: 200 });
    } catch (e: unknown) {
        return NextResponse.json(
            { error: "Server error", details: safeStr((e as { message?: unknown } | null)?.message ?? e) },
            { status: 500 }
        );
    }
}