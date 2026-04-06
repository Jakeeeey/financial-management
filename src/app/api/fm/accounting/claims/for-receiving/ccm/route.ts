import "server-only";

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

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

type CustomerRel = {
    id?: number | string | null;
    customer_name?: string | null;
};

type CustomerMemoRow = {
    id?: number | string | null;
    memo_number?: string | null;
    reason?: string | null;
    amount?: number | string | null;
    supplier_id?: number | string | null;
    customer_id?: number | string | CustomerRel | null;
    isPending?: unknown;
    isClaimed?: unknown;
};

type JsonWithDataArray = { data: unknown[] };

/* ================= Utils ================= */

function isObject(v: unknown): v is Record<string, unknown> {
    return typeof v === "object" && v !== null;
}

function hasDataArray(json: unknown): json is JsonWithDataArray {
    return isObject(json) && Array.isArray((json as { data?: unknown }).data);
}

function errMessage(e: unknown): string {
    if (e && typeof e === "object" && "message" in e) {
        const msg = (e as { message?: unknown }).message;
        return typeof msg === "string" ? msg : String(msg ?? e);
    }
    return String(e);
}

/* ================= Route ================= */

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const supplierId = searchParams.get("supplier_id");
        const q = (searchParams.get("q") ?? "").trim();
        const exclude = (searchParams.get("exclude_ids") ?? "")
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean);

        if (!supplierId) return NextResponse.json({ data: [] }, { status: 200 });

        const params = new URLSearchParams();
        params.set(
            "fields",
            "id,memo_number,reason,amount,supplier_id,customer_id,customer_id.customer_name,isPending,isClaimed"
        );
        params.set("limit", "200");
        params.set("sort", "-id");
        params.set("filter[supplier_id][_eq]", supplierId);

        // ✅ AVAILABLE ONLY:
        // isPending != true AND isClaimed != true
        // (handles BIT(1) + Buffer-ish cases safely in Directus filter layer)
        params.set("filter[_and][0][isPending][_neq]", "true");
        params.set("filter[_and][1][isClaimed][_neq]", "true");

        // exclude already-selected ids
        if (exclude.length) params.set("filter[id][_nin]", exclude.join(","));

        // search within available set
        if (q) {
            params.set("filter[_and][2][_or][0][memo_number][_icontains]", q);
            params.set("filter[_and][2][_or][1][reason][_icontains]", q);
        }

        const { res, json } = await directusFetch(
            `/items/customers_memo?${params.toString()}`
        );

        if (!res.ok) {
            return NextResponse.json(
                { error: "Directus error", details: JSON.stringify(json) },
                { status: res.status }
            );
        }

        const list: unknown[] = hasDataArray(json) ? json.data : [];

        const data: CustomerMemoRow[] = list.map((raw) =>
            isObject(raw) ? (raw as CustomerMemoRow) : {}
        );

        const mapped = data.map((row) => {
            const cust = row.customer_id;

            const customer_id =
                cust && typeof cust === "object"
                    ? Number((cust as CustomerRel).id ?? NaN)
                    : Number(cust ?? NaN);

            return {
                id: row.id ?? null,
                memo_number: row.memo_number ?? null,
                reason: row.reason ?? null,
                amount: row.amount ?? null,
                supplier_id: row.supplier_id ?? null,
                customer_id: Number.isFinite(customer_id) ? customer_id : null,
                customer_name:
                    cust && typeof cust === "object"
                        ? (cust as CustomerRel).customer_name ?? null
                        : null,

                // keep for debugging/verification (optional for UI)
                isPending: row.isPending ?? null,
                isClaimed: row.isClaimed ?? null,
            };
        });

        return NextResponse.json({ data: mapped }, { status: 200 });
    } catch (e: unknown) {
        return NextResponse.json(
            { error: "Unexpected error", details: errMessage(e) },
            { status: 500 }
        );
    }
}