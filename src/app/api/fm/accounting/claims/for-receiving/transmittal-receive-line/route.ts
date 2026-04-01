import "server-only";

import { NextRequest, NextResponse } from "next/server";

const TRANSMITTAL_COLLECTION = "claims_transmittal";
const DETAILS_COLLECTION = "claims_transmittal_details";
const CCM_COLLECTION = "customers_memo";

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

async function directusJson<T>(path: string, init?: RequestInit): Promise<T> {
    const { res, json } = await directusFetch(path, init);
    if (!res.ok) {
        throw new Error(typeof json === "string" ? json : JSON.stringify(json ?? {}));
    }
    return json as T;
}

/* ================= Types ================= */

type DirectusListResponse<T> = { data?: T[] };
type DirectusItemResponse<T> = { data?: T };

type ReceivePayload = {
    transmittal_id: number;
    detail_id: number;
    received_at?: string | null;
};

type DetailRow = {
    id?: number | string | null;
    customer_memo_id?: number | string | { id?: number | string | null } | null;
};

type PatchBody = { received_at: string };

type CCMReleaseBody = { isPending: 0 | 1; isClaimed: 0 | 1 };

/* ================= Utils ================= */

function isObject(v: unknown): v is Record<string, unknown> {
    return typeof v === "object" && v !== null;
}

function errMessage(e: unknown): string {
    if (e && typeof e === "object" && "message" in e) {
        const msg = (e as { message?: unknown }).message;
        return typeof msg === "string" ? msg : String(msg ?? e);
    }
    return String(e);
}

/* ================= Route ================= */

export async function POST(req: NextRequest) {
    try {
        const bodyUnknown: unknown = await req.json().catch(() => ({} as unknown));
        const body: Partial<ReceivePayload> = isObject(bodyUnknown)
            ? (bodyUnknown as Partial<ReceivePayload>)
            : {};

        const transmittal_id = Number(body.transmittal_id);
        const detail_id = Number(body.detail_id);

        if (!transmittal_id || Number.isNaN(transmittal_id)) {
            return NextResponse.json({ error: "transmittal_id is required" }, { status: 400 });
        }
        if (!detail_id || Number.isNaN(detail_id)) {
            return NextResponse.json({ error: "detail_id is required" }, { status: 400 });
        }

        const received_at = body.received_at ?? new Date().toISOString();

        // patch detail received_at
        const patchBody: PatchBody = { received_at };
        await directusJson<unknown>(`/items/${DETAILS_COLLECTION}/${detail_id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patchBody),
        });

        // check remaining unreceived lines
        const p = new URLSearchParams();
        p.set("limit", "1");
        p.set("fields", "id");
        p.set("filter[claims_transmittal_id][_eq]", String(transmittal_id));
        p.set("filter[received_at][_null]", "true");

        const remainJson = await directusJson<DirectusListResponse<{ id?: number | string | null }>>(
            `/items/${DETAILS_COLLECTION}?${p.toString()}`
        );
        const remaining = Array.isArray(remainJson?.data) ? remainJson.data.length : 0;

        // if none remaining, advance status
        if (remaining === 0) {
            await directusJson<unknown>(`/items/${TRANSMITTAL_COLLECTION}/${transmittal_id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "FOR PAYMENT" }),
            });
        }

        return NextResponse.json({ data: { ok: true, remaining } }, { status: 200 });
    } catch (e: unknown) {
        return NextResponse.json(
            { error: "Unexpected error", details: errMessage(e) },
            { status: 500 }
        );
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const detail_id = Number(searchParams.get("detail_id"));

        if (!detail_id || Number.isNaN(detail_id)) {
            return NextResponse.json({ error: "detail_id is required" }, { status: 400 });
        }

        // ✅ 1) fetch the detail first to get customer_memo_id
        // We request both forms because Directus can return relation as:
        // - number (id)
        // - object { id: number }
        const detailJson = await directusJson<DirectusItemResponse<DetailRow>>(
            `/items/${DETAILS_COLLECTION}/${detail_id}?fields=id,customer_memo_id,customer_memo_id.id`
        );

        const row = detailJson?.data ?? null;
        const cmRaw = row?.customer_memo_id;

        const customerMemoId =
            cmRaw && typeof cmRaw === "object"
                ? Number((cmRaw as { id?: unknown }).id ?? 0)
                : Number(cmRaw ?? 0);

        // ✅ 2) delete the detail line
        await directusJson<unknown>(`/items/${DETAILS_COLLECTION}/${detail_id}`, {
            method: "DELETE",
        });

        // ✅ 3) release CCM (so it becomes available again)
        if (customerMemoId && Number.isFinite(customerMemoId)) {
            const releaseBody: CCMReleaseBody = { isPending: 0, isClaimed: 0 };
            await directusJson<unknown>(`/items/${CCM_COLLECTION}/${customerMemoId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(releaseBody),
            });
        }

        return NextResponse.json(
            { data: { ok: true, released_memo_id: customerMemoId || null } },
            { status: 200 }
        );
    } catch (e: unknown) {
        return NextResponse.json(
            { error: "Unexpected error", details: errMessage(e) },
            { status: 500 }
        );
    }
}