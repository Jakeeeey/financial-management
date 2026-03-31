import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

const BALANCE_TYPE_COLLECTION = "balance_type";

function directusHeaders() {
    const token = process.env.DIRECTUS_STATIC_TOKEN;
    if (!DIRECTUS_URL) throw new Error("DIRECTUS_URL is not configured");
    if (!token) throw new Error("DIRECTUS_SERVICE_TOKEN is not configured");
    return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

function safeNum(v: unknown) {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : null;
}

type DirectusListResponse<T> = {
    data?: T[];
};

type BalanceTypeRow = {
    id?: number | string | null;
    balance_name?: string | null;
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
        const idsRaw = (searchParams.get("ids") ?? "").trim();
        const idRaw = (searchParams.get("id") ?? "").trim();

        const ids = (idsRaw ? idsRaw : idRaw)
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean)
            .map((x) => safeNum(x))
            .filter((x): x is number => x != null);

        if (ids.length === 0) return NextResponse.json({ data: [] }, { status: 200 });

        const params = new URLSearchParams();
        params.set("limit", String(Math.max(50, ids.length)));
        params.set("fields", "id,balance_name");
        params.set("filter[id][_in]", ids.join(","));

        const r = await fetch(
            `${DIRECTUS_URL}/items/${BALANCE_TYPE_COLLECTION}?${params.toString()}`,
            {
                method: "GET",
                headers: directusHeaders(),
                cache: "no-store",
            }
        );

        const jsonUnknown: unknown = await r.json().catch(() => ({} as unknown));

        if (!r.ok) {
            return NextResponse.json(
                { error: "Directus error", details: JSON.stringify(jsonUnknown) },
                { status: r.status }
            );
        }

        const json = jsonUnknown as DirectusListResponse<BalanceTypeRow>;
        const rows = Array.isArray(json?.data) ? json.data : [];

        const data = rows.map((row) => ({
            id: Number(row?.id),
            balance_name: row?.balance_name ?? null,
        }));

        return NextResponse.json({ data }, { status: 200 });
    } catch (e: unknown) {
        return NextResponse.json(
            { error: "Unexpected error", details: errMessage(e) },
            { status: 500 }
        );
    }
}