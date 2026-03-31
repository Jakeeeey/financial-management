//src/app/api/claims/for-payments/transmittal-details/route.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

const DETAILS_COLLECTION = "claims_transmittal_details";
const MEMO_COLLECTION = "customers_memo";
const COA_COLLECTION = "chart_of_accounts";
const CUSTOMER_COLLECTION = "customer";

function directusHeaders() {
    const token = process.env.DIRECTUS_STATIC_TOKEN;
    if (!DIRECTUS_URL) throw new Error("DIRECTUS_URL is not configured");
    if (!token) throw new Error("DIRECTUS_SERVICE_TOKEN is not configured");
    return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

type DirectusListResponse<T> = { data?: T[]; error?: unknown };

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
    customer_id?: number | string | null;
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

function safeText(v: unknown) {
    return typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();
}

function uniqNums(values: unknown[]) {
    const out: number[] = [];
    const seen = new Set<number>();
    for (const v of values) {
        const n = Number(v);
        if (!Number.isFinite(n) || n <= 0) continue;
        if (seen.has(n)) continue;
        seen.add(n);
        out.push(n);
    }
    return out;
}

function errMessage(e: unknown): string {
    if (e && typeof e === "object" && "message" in e) {
        const msg = (e as { message?: unknown }).message;
        return typeof msg === "string" ? msg : String(msg ?? e);
    }
    return String(e);
}

async function directusJson<T>(path: string): Promise<T> {
    const r = await fetch(`${DIRECTUS_URL}/items/${path}`, {
        method: "GET",
        headers: directusHeaders(),
        cache: "no-store",
    });

    const jsonUnknown: unknown = await r.json().catch(() => ({} as unknown));
    if (!r.ok) {
        const maybe = jsonUnknown as { error?: unknown };
        throw new Error(maybe?.error ? String(maybe.error) : JSON.stringify(jsonUnknown));
    }
    return jsonUnknown as T;
}

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const transmittalId = Number(searchParams.get("transmittal_id"));

        if (!transmittalId || Number.isNaN(transmittalId)) {
            return NextResponse.json({ data: [] }, { status: 200 });
        }

        // 1) details (includes received_at + remarks)
        const dp = new URLSearchParams();
        dp.set("limit", "500");
        dp.set("sort", "id");
        dp.set(
            "fields",
            [
                "id",
                "claims_transmittal_id",
                "customer_memo_id",
                "amount",
                "remarks",
                "received_at",
                "created_at",
            ].join(",")
        );
        dp.set("filter[claims_transmittal_id][_eq]", String(transmittalId));

        const detailsJson = await directusJson<DirectusListResponse<DetailRow>>(
            `${DETAILS_COLLECTION}?${dp.toString()}`
        );
        const detailRows = Array.isArray(detailsJson?.data) ? detailsJson.data : [];

        if (!detailRows.length) {
            return NextResponse.json({ data: [] }, { status: 200 });
        }

        // 2) memos: memo_number/reason/customer_id/chart_of_account
        const memoIds = uniqNums(detailRows.map((d) => d.customer_memo_id));
        const memoById = new Map<number, MemoRow>();

        if (memoIds.length) {
            const mp = new URLSearchParams();
            mp.set("limit", String(Math.max(500, memoIds.length)));
            mp.set(
                "fields",
                ["id", "memo_number", "reason", "customer_id", "chart_of_account"].join(",")
            );
            mp.set("filter[id][_in]", memoIds.join(","));

            const memosJson = await directusJson<DirectusListResponse<MemoRow>>(
                `${MEMO_COLLECTION}?${mp.toString()}`
            );
            (Array.isArray(memosJson?.data) ? memosJson.data : []).forEach((m) =>
                memoById.set(Number(m.id), m)
            );
        }

        // ✅ 3) COA (PK is coa_id, and your role can’t read field "id")
        const coaIds = uniqNums(
            memoIds
                .map((id) => memoById.get(id)?.chart_of_account)
                .filter((v) => v != null)
        );
        const coaById = new Map<number, COARow>();

        if (coaIds.length) {
            const cp = new URLSearchParams();
            cp.set("limit", String(Math.max(500, coaIds.length)));
            // IMPORTANT: use coa_id not id
            cp.set("fields", ["coa_id", "gl_code", "account_title"].join(","));
            cp.set("filter[coa_id][_in]", coaIds.join(","));

            const coaJson = await directusJson<DirectusListResponse<COARow>>(
                `${COA_COLLECTION}?${cp.toString()}`
            );
            (Array.isArray(coaJson?.data) ? coaJson.data : []).forEach((c) =>
                coaById.set(Number(c.coa_id), c)
            );
        }

        // 4) customers: customer_name
        const customerIds = uniqNums(
            memoIds
                .map((id) => memoById.get(id)?.customer_id)
                .filter((v) => v != null)
        );
        const customerById = new Map<number, CustomerRow>();

        if (customerIds.length) {
            const up = new URLSearchParams();
            up.set("limit", String(Math.max(500, customerIds.length)));
            up.set("fields", ["id", "customer_name"].join(","));
            up.set("filter[id][_in]", customerIds.join(","));

            const customersJson = await directusJson<DirectusListResponse<CustomerRow>>(
                `${CUSTOMER_COLLECTION}?${up.toString()}`
            );
            (Array.isArray(customersJson?.data) ? customersJson.data : []).forEach((u) =>
                customerById.set(Number(u.id), u)
            );
        }

        // 5) merge
        const data = detailRows.map((row) => {
            const memoId = Number(row.customer_memo_id);
            const memo = memoById.get(memoId);

            const coaId = Number(memo?.chart_of_account);
            const coa = coaById.get(coaId);

            const customerId = Number(memo?.customer_id);
            const cust = customerById.get(customerId);

            // prefer detail.remarks, fallback to memo.reason
            const remarks = safeText(row?.remarks) || safeText(memo?.reason) || "";

            return {
                id: Number(row.id),
                claims_transmittal_id: Number(row.claims_transmittal_id),
                customer_memo_id: memoId,

                received_at: row.created_at ?? null,
                memo_number: memo?.memo_number ?? null,
                customer_name: cust?.customer_name ?? null,

                // COA label
                gl_code: coa?.gl_code ?? null,
                account_title: coa?.account_title ?? null,

                remarks: remarks || null,
                amount: row.amount ?? null,

                // optional debug fields
                reason: memo?.reason ?? null,
                created_at: row.created_at ?? null,
                chart_of_account: Number.isFinite(coaId) ? coaId : null,
                customer_id: Number.isFinite(customerId) ? customerId : null,
            };
        });

        return NextResponse.json({ data }, { status: 200 });
    } catch (e: unknown) {
        return NextResponse.json(
            { error: "Unexpected error", details: errMessage(e) },
            { status: 500 }
        );
    }
}