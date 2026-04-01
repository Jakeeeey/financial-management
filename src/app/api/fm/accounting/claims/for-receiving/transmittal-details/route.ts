//src/app/api/claims/for-receiving/transmit-details/route.ts
import { NextResponse } from "next/server";

const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

const DETAILS_COLLECTION = "claims_transmittal_details";
const CCM_COLLECTION = "customers_memo";

type DirectusListResponse<T> = { data?: T[] };

type DetailRow = {
    id?: number | string | null;
    claims_transmittal_id?: number | string | null;
    customer_memo_id?: number | string | null;
    amount?: number | string | null;
    remarks?: string | null;
    received_at?: string | null;
    created_at?: string | null;

    // merged fields
    memo_number?: string | null;
    reason?: string | null;
    memo_status?: string | null;
};

type MemoRow = {
    id?: number | string | null;
    memo_number?: string | null;
    reason?: string | null;
    status?: string | null;
    amount?: number | string | null;
};

function errMessage(err: unknown): string {
    if (err && typeof err === "object" && "message" in err) {
        const msg = (err as { message?: unknown }).message;
        return typeof msg === "string" ? msg : String(msg ?? err);
    }
    return String(err);
}

async function fetchDirectus<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, { cache: "no-store", ...init });
    if (!res.ok) throw new Error(await res.text());
    return (await res.json()) as T;
}

export async function GET(req: Request) {
    try {
        if (!DIRECTUS_URL) {
            return NextResponse.json({ error: "DIRECTUS_URL is not set" }, { status: 500 });
        }

        const { searchParams } = new URL(req.url);
        const transmittalId = Number(searchParams.get("transmittal_id"));

        if (!transmittalId || Number.isNaN(transmittalId)) {
            return NextResponse.json({ data: [] }, { status: 200 });
        }

        const p = new URLSearchParams();
        p.set("limit", "500");
        p.set("sort", "id");
        p.set(
            "fields",
            "id,claims_transmittal_id,customer_memo_id,amount,remarks,received_at,created_at"
        );
        p.set("filter[claims_transmittal_id][_eq]", String(transmittalId));

        const url = `${DIRECTUS_URL}/items/${DETAILS_COLLECTION}?${p.toString()}`;
        const json = await fetchDirectus<DirectusListResponse<DetailRow>>(url);
        const rows = Array.isArray(json.data) ? json.data : [];

        const memoIds = Array.from(
            new Set(
                rows
                    .map((r) => Number(r.customer_memo_id))
                    .filter((n) => Number.isFinite(n) && n > 0)
            )
        );

        const memoMap = new Map<number, MemoRow>();

        if (memoIds.length) {
            const mp = new URLSearchParams();
            mp.set("limit", String(Math.max(50, memoIds.length)));
            mp.set("fields", "id,memo_number,reason,status,amount");
            mp.set("filter[id][_in]", memoIds.join(","));
            const memoUrl = `${DIRECTUS_URL}/items/${CCM_COLLECTION}?${mp.toString()}`;
            const memoJson = await fetchDirectus<DirectusListResponse<MemoRow>>(memoUrl);
            (Array.isArray(memoJson.data) ? memoJson.data : []).forEach((m) =>
                memoMap.set(Number(m.id), m)
            );
        }

        const merged: DetailRow[] = rows.map((d) => {
            const memo = memoMap.get(Number(d.customer_memo_id));
            return {
                ...d,
                memo_number: memo?.memo_number ?? `CCM #${d.customer_memo_id ?? "—"}`,
                reason: memo?.reason ?? null,
                memo_status: memo?.status ?? null,
            };
        });

        return NextResponse.json({ data: merged }, { status: 200 });
    } catch (err: unknown) {
        return NextResponse.json(
            { error: "Unexpected error", details: errMessage(err) },
            { status: 500 }
        );
    }
}