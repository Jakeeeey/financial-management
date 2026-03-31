import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

function directusHeaders() {
    const token = process.env.DIRECTUS_STATIC_TOKEN;
    if (!DIRECTUS_URL) throw new Error("DIRECTUS_URL is not configured");
    if (!token) throw new Error("DIRECTUS_SERVICE_TOKEN is not configured");
    return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

function isRecord(v: unknown): v is Record<string, unknown> {
    return typeof v === "object" && v !== null;
}

function errMessage(e: unknown): string {
    if (e && typeof e === "object" && "message" in e) {
        const msg = (e as { message?: unknown }).message;
        return typeof msg === "string" ? msg : String(msg ?? e);
    }
    return String(e);
}

function decodeUserIdFromJwtCookie(req: NextRequest, cookieName = "vos_access_token") {
    const token = req.cookies.get(cookieName)?.value;
    if (!token) return null;

    const parts = token.split(".");
    if (parts.length < 2) return null;

    try {
        const payloadPart = parts[1];
        const pad = "=".repeat((4 - (payloadPart.length % 4)) % 4);
        const b64 = (payloadPart + pad).replace(/-/g, "+").replace(/_/g, "/");
        const jsonStr = Buffer.from(b64, "base64").toString("utf8");
        const payloadUnknown: unknown = JSON.parse(jsonStr);

        const payload = isRecord(payloadUnknown) ? payloadUnknown : null;
        const userId = Number(payload?.sub);
        return Number.isFinite(userId) ? userId : null;
    } catch {
        return null;
    }
}

function uniqNums(values: unknown): number[] {
    if (!Array.isArray(values)) return [];
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

async function patchOne(collection: string, id: number, data: Record<string, unknown>) {
    const r = await fetch(`${DIRECTUS_URL}/items/${collection}/${id}`, {
        method: "PATCH",
        headers: directusHeaders(),
        body: JSON.stringify(data),
        cache: "no-store",
    });

    const jsonUnknown: unknown = await r.json().catch(() => ({} as unknown));
    if (!r.ok) {
        throw new Error(
            `Directus error patchOne(${collection}/${id}): ${JSON.stringify(jsonUnknown)}`
        );
    }
}

type DirectusListResponse<T> = { data?: T[] };

type CustomerMemoRow = {
    id?: number | string | null;
    amount?: number | string | null;
};

async function computeCustomersMemoTotal(memoIds: number[]): Promise<number> {
    if (!memoIds.length) return 0;

    const params = new URLSearchParams();
    params.set("limit", String(Math.max(200, memoIds.length)));
    params.set("fields", ["id", "amount"].join(","));
    params.set("filter[id][_in]", memoIds.join(","));

    const r = await fetch(`${DIRECTUS_URL}/items/customers_memo?${params.toString()}`, {
        method: "GET",
        headers: directusHeaders(),
        cache: "no-store",
    });

    const jsonUnknown: unknown = await r.json().catch(() => ({} as unknown));
    if (!r.ok) {
        throw new Error(`Directus error fetching customers_memo: ${JSON.stringify(jsonUnknown)}`);
    }

    const json = jsonUnknown as DirectusListResponse<CustomerMemoRow>;
    const rows = Array.isArray(json?.data) ? json.data : [];

    let sum = 0;
    for (const row of rows) {
        const amt = Number(row?.amount ?? 0);
        if (Number.isFinite(amt)) sum += amt;
    }
    return Math.round(sum * 100) / 100;
}

type PostBody = {
    id?: unknown;
    status?: unknown;
    included_memo_ids?: unknown;
    excluded_memo_ids?: unknown;
};

type ClaimsTransmittalPatchPayload = {
    status: string;
    updated_by: number;
    total_amount?: number;
};

export async function POST(req: NextRequest) {
    try {
        const userId = decodeUserIdFromJwtCookie(req);
        if (!userId) {
            return NextResponse.json(
                { error: "Unauthorized (missing/invalid token)" },
                { status: 401 }
            );
        }

        const bodyUnknown: unknown = await req.json();
        const body: PostBody = isRecord(bodyUnknown) ? (bodyUnknown as PostBody) : {};

        const id = Number(body?.id);
        const status = String(body?.status ?? "").trim();

        if (!id || !status) {
            return NextResponse.json({ error: "id and status are required" }, { status: 400 });
        }

        let computedTotalAmount: number | null = null;

        if (status.toUpperCase() === "POSTED") {
            const includedMemoIds = uniqNums(body?.included_memo_ids);
            const excludedMemoIds = uniqNums(body?.excluded_memo_ids);

            if (includedMemoIds.length === 0) {
                return NextResponse.json(
                    {
                        error: "included_memo_ids is required when posting (must include at least one memo).",
                    },
                    { status: 400 }
                );
            }

            const includedSet = new Set(includedMemoIds);
            const safeExcluded = excludedMemoIds.filter((n) => !includedSet.has(n));

            // ✅ total_amount = sum(included memos)
            computedTotalAmount = await computeCustomersMemoTotal(includedMemoIds);

            // ✅ included => isPending=1, isClaimed=1
            for (const memoId of includedMemoIds) {
                await patchOne("customers_memo", memoId, { isPending: 1, isClaimed: 1 });
            }

            // ✅ excluded => RELEASE: isPending=0, isClaimed=0
            for (const memoId of safeExcluded) {
                await patchOne("customers_memo", memoId, { isPending: 0, isClaimed: 0 });
            }
        }

        const payload: ClaimsTransmittalPatchPayload = { status, updated_by: userId };
        if (computedTotalAmount !== null) payload.total_amount = computedTotalAmount;

        const r = await fetch(`${DIRECTUS_URL}/items/claims_transmittal/${id}`, {
            method: "PATCH",
            headers: directusHeaders(),
            body: JSON.stringify(payload),
            cache: "no-store",
        });

        const jsonUnknown: unknown = await r.json().catch(() => ({} as unknown));
        if (!r.ok) {
            return NextResponse.json(
                { error: "Directus error", details: JSON.stringify(jsonUnknown) },
                { status: r.status }
            );
        }

        return NextResponse.json({ ok: true }, { status: 200 });
    } catch (e: unknown) {
        return NextResponse.json(
            { error: "Unexpected error", details: errMessage(e) },
            { status: 500 }
        );
    }
}