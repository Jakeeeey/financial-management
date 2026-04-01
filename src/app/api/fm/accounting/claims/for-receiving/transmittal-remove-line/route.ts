import { NextResponse } from "next/server";

const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

const DETAILS_COLLECTION = "claims_transmittal_details";
const CCM_COLLECTION = "customers_memo";

function directusHeaders() {
    const token = process.env.DIRECTUS_STATIC_TOKEN;
    if (!DIRECTUS_URL) throw new Error("DIRECTUS_URL is not configured");
    if (!token) throw new Error("DIRECTUS_SERVICE_TOKEN is not configured");
    return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

function isRecord(v: unknown): v is Record<string, unknown> {
    return typeof v === "object" && v !== null;
}

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

    // Directus DELETE often returns empty body; handle that.
    const text = await res.text();
    return (text ? (JSON.parse(text) as T) : ({} as T));
}

type BodyPayload = { detail_id?: unknown };

type MemoRel = { id?: number | string | null } | number | string | null;

type DetailData = {
    id?: number | string | null;
    customer_memo_id?: MemoRel;
};

type DirectusItemResponse<T> = { data?: T };

export async function POST(req: Request) {
    try {
        if (!DIRECTUS_URL) {
            return NextResponse.json({ error: "DIRECTUS_URL is not set" }, { status: 500 });
        }

        const bodyUnknown: unknown = await req.json();
        const body: BodyPayload = isRecord(bodyUnknown) ? (bodyUnknown as BodyPayload) : {};

        const detail_id = Number(body.detail_id);

        if (!detail_id || Number.isNaN(detail_id)) {
            return NextResponse.json({ error: "detail_id is required" }, { status: 400 });
        }

        // 1) Fetch detail to know which customer_memo_id to release
        const detail = await fetchDirectus<DirectusItemResponse<DetailData>>(
            `${DIRECTUS_URL}/items/${DETAILS_COLLECTION}/${detail_id}?fields=id,customer_memo_id.id,customer_memo_id`,
            {
                method: "GET",
                headers: directusHeaders(),
            }
        );

        const rawMemo: MemoRel | undefined = detail?.data?.customer_memo_id;

        const memoId =
            rawMemo && typeof rawMemo === "object"
                ? Number((rawMemo as { id?: unknown }).id ?? 0)
                : Number(rawMemo ?? 0);

        // 2) Delete the detail line
        await fetchDirectus<unknown>(`${DIRECTUS_URL}/items/${DETAILS_COLLECTION}/${detail_id}`, {
            method: "DELETE",
            headers: directusHeaders(),
        });

        // 3) Release the CCM so it can be fetched again in Generate Transmittal
        //    (only if memoId is valid)
        if (memoId && Number.isFinite(memoId)) {
            await fetchDirectus<unknown>(`${DIRECTUS_URL}/items/${CCM_COLLECTION}/${memoId}`, {
                method: "PATCH",
                headers: directusHeaders(),
                body: JSON.stringify({
                    isPending: 0,
                    isClaimed: 0,
                }),
            });
        }

        return NextResponse.json(
            { data: { ok: true, released_memo_id: memoId || null } },
            { status: 200 }
        );
    } catch (err: unknown) {
        return NextResponse.json(
            { error: "Unexpected error", details: errMessage(err) },
            { status: 500 }
        );
    }
}