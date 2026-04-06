import "server-only";

import { NextRequest, NextResponse } from "next/server";

const DETAILS_COLLECTION = "claims_transmittal_details";
const CCM_COLLECTION = "customers_memo";
const COA_COLLECTION = "chart_of_accounts";
const CUSTOMER_COLLECTION = "customer";
const SUPPLIERS_COLLECTION = "suppliers";
const HEADER_COLLECTION = "claims_transmittal";

/* ================= Directus helpers (inlined) ================= */

const DIRECTUS_URL: string | undefined = process.env.NEXT_PUBLIC_API_BASE_URL;

function directusHeaders(): Record<string, string> {
    const token: string | undefined = process.env.DIRECTUS_STATIC_TOKEN;

    if (!DIRECTUS_URL) throw new Error("Missing DIRECTUS_URL");
    if (!token) throw new Error("Missing DIRECTUS_STATIC_TOKEN");

    return {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
    };
}

async function directusFetch(
    path: string,
    init?: RequestInit
): Promise<{ res: Response; json: unknown }> {
    if (!DIRECTUS_URL) throw new Error("Missing DIRECTUS_URL");

    const res = await fetch(`${DIRECTUS_URL}${path}`, {
        ...init,
        headers: {
            ...directusHeaders(),
            ...(init?.headers ?? {}),
        },
        cache: "no-store",
    });

    const json: unknown = await res.json().catch(() => ({}));
    return { res, json };
}

/* ================= Types ================= */

type DirectusListResponse<T> = { data?: T[] };

type DirectusAggSumRow = { sum?: { amount?: number | string | null } };
type DirectusAggResponse = { data?: DirectusAggSumRow[] };

type DetailRow = {
    id?: number | string | null;
    claims_transmittal_id?: number | string | null;
    customer_memo_id?: number | string | null;
    amount?: number | string | null;
    remarks?: string | null;
    received_at?: string | null;
    created_at?: string | null;
};

type MemoRow = {
    id?: number | string | null;
    memo_number?: string | null;
    reason?: string | null;
    status?: string | null;
    amount?: number | string | null;
    created_at?: string | null;
    customer_id?: number | string | null;
    supplier_id?: number | string | null;
    chart_of_account?: number | string | null;
};

type COARow = {
    coa_id?: number | string | null;
    gl_code?: string | null;
    account_title?: string | null;
};

type CustomerRow = {
    id?: number | string | null;
    customer_name?: string | null;
};

type SupplierRow = {
    id?: number | string | null;
    supplier_name?: string | null;
    supplier_shortcut?: string | null;
};

/* ================= Utils ================= */

async function directusJson<T>(path: string, init?: RequestInit): Promise<T> {
    const { res, json } = await directusFetch(path, init);
    if (!res.ok) {
        throw new Error(typeof json === "string" ? json : JSON.stringify(json ?? {}));
    }
    return json as T;
}

function errMessage(e: unknown): string {
    if (e && typeof e === "object" && "message" in e) {
        const msg = (e as { message?: unknown }).message;
        return typeof msg === "string" ? msg : String(msg ?? e);
    }
    return String(e);
}

function safeNum(v: unknown, fallback = 0): number {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : fallback;
}

function safeStr(v: unknown): string {
    return typeof v === "string" ? v : v == null ? "" : String(v);
}

function toPosInt(v: unknown): number | null {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

function uniqPosInts(values: unknown[]): number[] {
    const out: number[] = [];
    const seen = new Set<number>();
    for (const v of values) {
        const n = toPosInt(v);
        if (!n) continue;
        if (seen.has(n)) continue;
        seen.add(n);
        out.push(n);
    }
    return out;
}

function uniq(arr: number[]): number[] {
    return Array.from(new Set(arr));
}

/**
 * GET /api/fm/claims/for-receiving/transmit-details?transmittal_id=123
 * (Your enriched version kept)
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const transmittalId = Number(searchParams.get("transmittal_id"));

        if (!transmittalId || Number.isNaN(transmittalId)) {
            return NextResponse.json({ data: [] }, { status: 200 });
        }

        // 1) fetch details
        const p = new URLSearchParams();
        p.set("limit", "500");
        p.set("sort", "id");
        p.set(
            "fields",
            "id,claims_transmittal_id,customer_memo_id,amount,remarks,received_at,created_at"
        );
        p.set("filter[claims_transmittal_id][_eq]", String(transmittalId));

        const detailsJson = await directusJson<DirectusListResponse<DetailRow>>(
            `/items/${DETAILS_COLLECTION}?${p.toString()}`
        );
        const rows = Array.isArray(detailsJson?.data) ? detailsJson.data : [];

        if (rows.length === 0) return NextResponse.json({ data: [] }, { status: 200 });

        // 2) batch fetch memos (customers_memo) with the fields we need
        const memoIds = Array.from(
            new Set(
                rows
                    .map((r) => Number(r.customer_memo_id))
                    .filter((n) => Number.isFinite(n) && n > 0)
            )
        );

        const memoMap = new Map<number, MemoRow>();
        const coaIds: number[] = [];
        const customerIds: number[] = [];
        const supplierIds: number[] = [];

        if (memoIds.length) {
            const mp = new URLSearchParams();
            mp.set("limit", String(Math.max(50, memoIds.length)));
            mp.set(
                "fields",
                [
                    "id",
                    "memo_number",
                    "reason",
                    "status",
                    "amount",
                    "created_at",
                    "customer_id",
                    "supplier_id",
                    "chart_of_account",
                ].join(",")
            );
            mp.set("filter[id][_in]", memoIds.join(","));

            const memoJson = await directusJson<DirectusListResponse<MemoRow>>(
                `/items/${CCM_COLLECTION}?${mp.toString()}`
            );

            (Array.isArray(memoJson?.data) ? memoJson.data : []).forEach((m) => {
                const id = Number(m.id);
                if (!Number.isFinite(id) || id <= 0) return;

                memoMap.set(id, m);

                const coa = Number(m?.chart_of_account);
                if (Number.isFinite(coa) && coa > 0) coaIds.push(coa);

                const cust = Number(m?.customer_id);
                if (Number.isFinite(cust) && cust > 0) customerIds.push(cust);

                const sup = Number(m?.supplier_id);
                if (Number.isFinite(sup) && sup > 0) supplierIds.push(sup);
            });
        }

        // 3) batch fetch COA titles
        const coaMap = new Map<number, { gl_code: string | null; account_title: string | null }>();
        const coaIdList = uniq(coaIds);

        if (coaIdList.length) {
            const cp = new URLSearchParams();
            cp.set("limit", String(Math.max(50, coaIdList.length)));
            cp.set("fields", "coa_id,gl_code,account_title");
            cp.set("filter[coa_id][_in]", coaIdList.join(","));

            const coaJson = await directusJson<DirectusListResponse<COARow>>(
                `/items/${COA_COLLECTION}?${cp.toString()}`
            );

            (Array.isArray(coaJson?.data) ? coaJson.data : []).forEach((c) => {
                const id = Number(c?.coa_id);
                if (!Number.isFinite(id) || id <= 0) return;

                coaMap.set(id, {
                    gl_code: typeof c?.gl_code === "string" ? c.gl_code : null,
                    account_title: typeof c?.account_title === "string" ? c.account_title : null,
                });
            });
        }

        // 4) batch fetch customers
        const customerMap = new Map<number, string>();
        const custIdList = uniq(customerIds);

        if (custIdList.length) {
            const up = new URLSearchParams();
            up.set("limit", String(Math.max(50, custIdList.length)));
            up.set("fields", "id,customer_name");
            up.set("filter[id][_in]", custIdList.join(","));

            const custJson = await directusJson<DirectusListResponse<CustomerRow>>(
                `/items/${CUSTOMER_COLLECTION}?${up.toString()}`
            );

            (Array.isArray(custJson?.data) ? custJson.data : []).forEach((u) => {
                const id = Number(u?.id);
                if (!Number.isFinite(id) || id <= 0) return;
                const name = safeStr(u?.customer_name).trim();
                if (name) customerMap.set(id, name);
            });
        }

        // 5) batch fetch suppliers
        const supplierMap = new Map<number, string>();
        const supIdList = uniq(supplierIds);

        if (supIdList.length) {
            const sp = new URLSearchParams();
            sp.set("limit", String(Math.max(20, supIdList.length)));
            sp.set("fields", "id,supplier_name,supplier_shortcut");
            sp.set("filter[id][_in]", supIdList.join(","));

            const supJson = await directusJson<DirectusListResponse<SupplierRow>>(
                `/items/${SUPPLIERS_COLLECTION}?${sp.toString()}`
            );

            (Array.isArray(supJson?.data) ? supJson.data : []).forEach((s) => {
                const id = Number(s?.id);
                if (!Number.isFinite(id) || id <= 0) return;

                const label = s?.supplier_shortcut
                    ? `${safeStr(s?.supplier_name)} (${safeStr(s?.supplier_shortcut)})`
                    : safeStr(s?.supplier_name);

                supplierMap.set(id, label.trim() || `Supplier #${id}`);
            });
        }

        // 6) merge and return enriched rows
        const merged = rows.map((d) => {
            const memo = memoMap.get(Number(d.customer_memo_id));

            const chartOfAccount = Number(memo?.chart_of_account);
            const coa = Number.isFinite(chartOfAccount) ? coaMap.get(chartOfAccount) : undefined;

            const customerId = Number(memo?.customer_id);
            const supplierId = Number(memo?.supplier_id);

            const remarks = safeStr(d?.remarks).trim() || safeStr(memo?.reason).trim() || null;

            const total = safeNum(d?.amount ?? memo?.amount, 0);
            const grandTotal = total;

            return {
                ...d,

                memo_number: memo?.memo_number ?? null,
                reason: memo?.reason ?? null,
                memo_status: memo?.status ?? null,

                credit_date: memo?.created_at ?? null,
                chart_of_account: Number.isFinite(chartOfAccount) ? chartOfAccount : null,
                gl_code: coa?.gl_code ?? null,
                account_title: coa?.account_title ?? null,

                supplier_id: Number.isFinite(supplierId) ? supplierId : null,
                supplier_name: Number.isFinite(supplierId) ? supplierMap.get(supplierId) ?? null : null,

                customer_id: Number.isFinite(customerId) ? customerId : null,
                customer_name: Number.isFinite(customerId) ? customerMap.get(customerId) ?? null : null,

                remarks,
                total,
                grand_total: grandTotal,
            };
        });

        return NextResponse.json({ data: merged }, { status: 200 });
    } catch (e: unknown) {
        return NextResponse.json(
            { error: "Unexpected error", details: errMessage(e) },
            { status: 500 }
        );
    }
}

/**
 * POST /api/fm/claims/for-receiving/transmit-details
 * Body: { claims_transmittal_id: number, customer_memo_ids: number[] }
 *
 * ✅ Adds details (bulk)
 * ✅ Updates CCM flags: isPending=1, isClaimed=0 (like old code)
 * ✅ Recomputes and updates header total_amount (like old code)
 * ✅ Dedupes: only inserts + flags memos not already in the transmittal
 */
type PostBody = {
    claims_transmittal_id?: unknown;
    customer_memo_ids?: unknown;
};

type ExistingDetailRow = {
    id?: number | string | null;
    customer_memo_id?: number | string | null;
};

type CCMAmountRow = {
    id?: number | string | null;
    amount?: number | string | null;
};

export async function POST(req: NextRequest) {
    try {
        const bodyUnknown: unknown = await req.json().catch(() => ({} as unknown));
        const body: PostBody =
            typeof bodyUnknown === "object" && bodyUnknown !== null ? (bodyUnknown as PostBody) : {};

        const transmittalId = toPosInt(body?.claims_transmittal_id);
        const memoIds = uniqPosInts(
            Array.isArray(body?.customer_memo_ids) ? (body.customer_memo_ids as unknown[]) : []
        );

        if (!transmittalId || memoIds.length === 0) {
            return NextResponse.json(
                { error: "claims_transmittal_id and customer_memo_ids are required" },
                { status: 400 }
            );
        }

        // 1) Find existing memo links for this transmittal (dedupe)
        const checkParams = new URLSearchParams();
        checkParams.set("limit", String(Math.max(50, memoIds.length)));
        checkParams.set("fields", "id,customer_memo_id");
        checkParams.set("filter[claims_transmittal_id][_eq]", String(transmittalId));
        checkParams.set("filter[customer_memo_id][_in]", memoIds.join(","));

        const existingJson = await directusJson<DirectusListResponse<ExistingDetailRow>>(
            `/items/${DETAILS_COLLECTION}?${checkParams.toString()}`
        );

        const existingSet = new Set<number>(
            (Array.isArray(existingJson?.data) ? existingJson.data : [])
                .map((r) => toPosInt(r?.customer_memo_id))
                .filter((n): n is number => typeof n === "number" && Number.isFinite(n) && n > 0)
        );

        const toInsertIds = memoIds.filter((id) => !existingSet.has(id));

        // 2) Fetch CCM amounts for ONLY new IDs (to set detail.amount)
        const memoAmountMap = new Map<number, number>();

        if (toInsertIds.length) {
            const mp = new URLSearchParams();
            mp.set("limit", String(Math.max(50, toInsertIds.length)));
            mp.set("fields", "id,amount");
            mp.set("filter[id][_in]", toInsertIds.join(","));

            const ccmsJson = await directusJson<DirectusListResponse<CCMAmountRow>>(
                `/items/${CCM_COLLECTION}?${mp.toString()}`
            );

            const list = Array.isArray(ccmsJson?.data) ? ccmsJson.data : [];
            list.forEach((x) => memoAmountMap.set(Number(x.id), safeNum(x.amount, 0)));
        }

        // 3) Insert details (bulk) for new IDs
        if (toInsertIds.length) {
            const payload = toInsertIds.map((memoId) => ({
                claims_transmittal_id: transmittalId,
                customer_memo_id: memoId,
                amount: safeNum(memoAmountMap.get(memoId), 0),
                remarks: null,
                received_at: null,
            }));

            await directusJson<unknown>(`/items/${DETAILS_COLLECTION}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
        }

        // 4) ✅ Adopt old behavior: mark CCMs as pending/claimed (ONLY for newly inserted)
        for (const memoId of toInsertIds) {
            await directusJson<unknown>(`/items/${CCM_COLLECTION}/${memoId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    isPending: 1,
                    isClaimed: 0,
                }),
            });
        }

        // 5) ✅ Adopt old behavior: recompute total and update header.total_amount
        const aggParams = new URLSearchParams();
        aggParams.set("filter[claims_transmittal_id][_eq]", String(transmittalId));
        aggParams.set("aggregate[sum]", "amount");

        const aggJson = await directusJson<DirectusAggResponse>(
            `/items/${DETAILS_COLLECTION}?${aggParams.toString()}`
        );
        const total = safeNum(aggJson?.data?.[0]?.sum?.amount, 0);

        await directusJson<unknown>(`/items/${HEADER_COLLECTION}/${transmittalId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ total_amount: total }),
        });

        return NextResponse.json(
            {
                ok: true,
                total_amount: total,
                created: toInsertIds.length,
                skipped: memoIds.length - toInsertIds.length,
            },
            { status: 200 }
        );
    } catch (e: unknown) {
        return NextResponse.json(
            { error: "Unexpected error", details: errMessage(e) },
            { status: 500 }
        );
    }
}