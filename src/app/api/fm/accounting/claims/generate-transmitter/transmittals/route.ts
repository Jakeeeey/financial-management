// src/app/api/claims/generate-transmitter/route.ts
import { NextRequest, NextResponse } from "next/server";

const DIRECTUS_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/+$/, "") + "/";

const CCM_COLLECTION = "customers_memo";
const TRANSMITTAL_COLLECTION = "claims_transmittal";
const TRANSMITTAL_DETAILS_COLLECTION = "claims_transmittal_details";

type CreatePayload = {
    supplier_id: number;
    supplier_representative_id: number;
    customer_memo_ids: number[];
};

type DirectusListResponse<T> = { data?: T[]; error?: unknown };
type DirectusItemResponse<T> = { data?: T; error?: unknown };

type CCMRow = {
    id?: number | string | null;
    amount?: number | string | null;
    supplier_id?: number | string | null;
    isPending?: unknown;
    isClaimed?: unknown;
    memo_number?: string | null;
};

type CreatedHeaderRow = {
    id?: number | string | null;
};

function errMessage(e: unknown): string {
    if (e && typeof e === "object" && "message" in e) {
        const msg = (e as { message?: unknown }).message;
        return typeof msg === "string" ? msg : String(msg ?? e);
    }
    return String(e);
}

function makeTransmittalNo() {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const mi = pad(d.getMinutes());
    const ss = pad(d.getSeconds());
    return `TRN-${yyyy}-${mm}${dd}-${hh}${mi}${ss}`;
}

async function fetchDirectus<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, { cache: "no-store", ...init });

    const text = await res.text();
    let jsonUnknown: unknown = {};
    try {
        jsonUnknown = text ? (JSON.parse(text) as unknown) : {};
    } catch {
        jsonUnknown = { raw: text };
    }

    if (!res.ok) throw new Error(JSON.stringify(jsonUnknown));
    return jsonUnknown as T;
}

/**
 * Decode JWT payload (NO VERIFY) and extract numeric userId from `sub`.
 * HttpOnly cookie is readable here because this runs on the server.
 */
function decodeUserIdFromJwtCookie(
    req: NextRequest,
    cookieName = "vos_access_token"
): number | null {
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
        const sub =
            payloadUnknown && typeof payloadUnknown === "object" && "sub" in payloadUnknown
                ? (payloadUnknown as { sub?: unknown }).sub
                : undefined;

        const userId = Number(sub);
        return Number.isFinite(userId) ? userId : null;
    } catch {
        return null;
    }
}

export async function POST(req: NextRequest) {
    try {
        if (!DIRECTUS_URL.trim() || DIRECTUS_URL === "/") {
            return NextResponse.json({ error: "DIRECTUS_URL is not set" }, { status: 500 });
        }

        // ✅ Extract user id from JWT cookie
        const userId = decodeUserIdFromJwtCookie(req);
        if (!userId) {
            return NextResponse.json(
                { error: "Unauthorized (missing/invalid token)" },
                { status: 401 }
            );
        }

        const body = (await req.json()) as Partial<CreatePayload>;
        const supplier_id = Number(body.supplier_id);
        const supplier_representative_id = Number(body.supplier_representative_id);
        const customer_memo_ids = Array.isArray(body.customer_memo_ids)
            ? body.customer_memo_ids.map(Number)
            : [];

        if (!supplier_id || Number.isNaN(supplier_id)) {
            return NextResponse.json({ error: "supplier_id is required" }, { status: 400 });
        }
        if (!supplier_representative_id || Number.isNaN(supplier_representative_id)) {
            return NextResponse.json(
                { error: "supplier_representative_id is required" },
                { status: 400 }
            );
        }
        if (
            customer_memo_ids.length === 0 ||
            customer_memo_ids.some((x) => !x || Number.isNaN(x))
        ) {
            return NextResponse.json(
                { error: "customer_memo_ids must be a non-empty number array" },
                { status: 400 }
            );
        }

        // 1) Fetch CCMs to validate + total
        const ccmParams = new URLSearchParams();
        ccmParams.set("limit", String(Math.min(500, customer_memo_ids.length)));
        ccmParams.set("fields", "id,amount,supplier_id,isPending,isClaimed,memo_number");
        ccmParams.set("filter[id][_in]", customer_memo_ids.join(","));

        const ccmUrl = `${DIRECTUS_URL}items/${CCM_COLLECTION}?${ccmParams.toString()}`;
        const ccmJson = await fetchDirectus<DirectusListResponse<CCMRow>>(ccmUrl);
        const rows = Array.isArray(ccmJson.data) ? ccmJson.data : [];

        if (rows.length !== customer_memo_ids.length) {
            return NextResponse.json(
                { error: "Some customer memo IDs were not found" },
                { status: 400 }
            );
        }

        for (const r of rows) {
            if (Number(r.supplier_id) !== supplier_id) {
                return NextResponse.json(
                    { error: "All selected memos must belong to the same supplier" },
                    { status: 400 }
                );
            }
            if (r.isPending === true || r.isClaimed === true) {
                return NextResponse.json(
                    { error: `Memo ${r.memo_number ?? r.id} is not available` },
                    { status: 400 }
                );
            }
        }

        const total_amount = rows.reduce((sum, r) => sum + Number(r.amount ?? 0), 0);

        // 2) Create header
        const transmittal_no = makeTransmittalNo();
        const status = "FOR RECEIVING";

        const headerPayload = {
            supplier_id,
            supplier_representative_id,
            total_amount,
            transmittal_no,
            status,

            // ✅ Set audit fields from JWT sub
            created_by: userId,
            updated_by: userId,
        };

        const headerUrl = `${DIRECTUS_URL}items/${TRANSMITTAL_COLLECTION}`;
        const headerRes = await fetchDirectus<DirectusItemResponse<CreatedHeaderRow>>(headerUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(headerPayload),
        });

        const claims_transmittal_id = Number(headerRes?.data?.id);
        if (!claims_transmittal_id || Number.isNaN(claims_transmittal_id)) {
            throw new Error("Failed to create transmittal header (missing id)");
        }

        // 3) Create details
        const detailsPayload = rows.map((r) => ({
            claims_transmittal_id,
            customer_memo_id: Number(r.id),
            amount: Number(r.amount ?? 0),
            remarks: null as string | null,
            received_at: null as string | null,
        }));

        const detailsUrl = `${DIRECTUS_URL}items/${TRANSMITTAL_DETAILS_COLLECTION}`;
        await fetchDirectus<unknown>(detailsUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(detailsPayload),
        });

        // 4) Lock CCMs by marking pending (+ updated_by)
        await Promise.all(
            rows.map((r) =>
                fetchDirectus<unknown>(`${DIRECTUS_URL}items/${CCM_COLLECTION}/${String(r.id)}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ isPending: true }),
                })
            )
        );

        return NextResponse.json(
            {
                data: {
                    id: claims_transmittal_id,
                    transmittal_no,
                    supplier_id,
                    supplier_representative_id,
                    status,
                    total_amount,
                    count: rows.length,
                    created_by: userId,
                    updated_by: userId,
                },
            },
            { status: 201 }
        );
    } catch (err: unknown) {
        return NextResponse.json(
            { error: "Unexpected error", details: errMessage(err) },
            { status: 500 }
        );
    }
}