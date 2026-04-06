import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

/**
 * Your relation in other code uses: customer_id.customer_name
 * So this is likely correct — but the code/shortcut fields are unknown.
 */
const CUSTOMER_COLLECTION = "customer";

function directusHeaders() {
    const token = process.env.DIRECTUS_STATIC_TOKEN;
    if (!DIRECTUS_URL) throw new Error("DIRECTUS_URL is not configured");
    if (!token) throw new Error("DIRECTUS_SERVICE_TOKEN is not configured");
    return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

function safeStr(v: unknown) {
    return typeof v === "string" ? v : v == null ? "" : String(v);
}

type DirectusListResponse<T> = {
    data?: T[];
};

type CustomerRow = {
    id?: number | string | null;
    customer_name?: string | null;
};

function errMessage(e: unknown): string {
    if (e && typeof e === "object" && "message" in e) {
        const msg = (e as { message?: unknown }).message;
        return typeof msg === "string" ? msg : String(msg ?? e);
    }
    return String(e);
}

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const q = (searchParams.get("q") ?? "").trim();

        if (!q) return NextResponse.json({ data: [] }, { status: 200 });

        const params = new URLSearchParams();
        params.set("limit", "50");
        params.set("sort", "customer_name");

        /**
         * ✅ `search` performs a broad match without you needing to know the exact field name.
         */
        params.set("search", q);

        /**
         * Keep fields conservative (avoid Directus errors for unknown fields).
         */
        params.set("fields", "id,customer_name");

        const r = await fetch(`${DIRECTUS_URL}/items/${CUSTOMER_COLLECTION}?${params.toString()}`, {
            method: "GET",
            headers: directusHeaders(),
            cache: "no-store",
        });

        const jsonUnknown: unknown = await r.json().catch(() => ({} as unknown));

        if (!r.ok) {
            return NextResponse.json(
                { error: "Directus error", details: JSON.stringify(jsonUnknown) },
                { status: r.status }
            );
        }

        const json = jsonUnknown as DirectusListResponse<CustomerRow>;
        const rows = Array.isArray(json?.data) ? json.data : [];

        const data = rows
            .map((row) => {
                const id = Number(row?.id);
                const name = safeStr(row?.customer_name).trim();
                return { id, label: name || `Customer #${id}` };
            })
            .filter((x) => Number.isFinite(x.id));

        return NextResponse.json({ data }, { status: 200 });
    } catch (e: unknown) {
        return NextResponse.json(
            { error: "Unexpected error", details: errMessage(e) },
            { status: 500 }
        );
    }
}