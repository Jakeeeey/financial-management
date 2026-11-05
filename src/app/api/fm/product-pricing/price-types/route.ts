import { NextRequest, NextResponse } from "next/server";
import { fetchPriceTypeDirectus, priceTypeErrorResponse } from "./_directus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const COLLECTION = "price_types";

type JwtPayload = {
    sub?: string | number | null;
};

type PriceTypeRow = {
    price_type_id?: number | string | null;
    price_type_name?: string | null;
    sort?: number | string | null;
    is_active?: boolean | number | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
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

        if (!isRecord(payloadUnknown)) return null;

        const payload = payloadUnknown as JwtPayload;
        const userId = Number(payload.sub);
        return Number.isFinite(userId) ? userId : null;
    } catch {
        return null;
    }
}

export async function GET(req: NextRequest) {
    try {
        if (!DIRECTUS_URL) {
            return NextResponse.json({ error: "NEXT_PUBLIC_API_BASE_URL is not set" }, { status: 500 });
        }

        const userId = decodeUserIdFromJwtCookie(req);
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const params = new URLSearchParams();
        params.set("limit", "-1");
        params.set("fields", "price_type_id,price_type_name,sort,is_active");
        params.set("sort", "sort,price_type_id");
        const includeInactive = req.nextUrl.searchParams.get("include_inactive") === "true";
        if (!includeInactive) params.set("filter[is_active][_eq]", "1");

        const url = `${DIRECTUS_URL}/items/${COLLECTION}?${params.toString()}`;
        const json = await fetchPriceTypeDirectus<{ data: PriceTypeRow[] }>(url);

        return NextResponse.json({ data: json.data ?? [] });
    } catch (error: unknown) {
        return priceTypeErrorResponse(error);
    }
}

export async function POST(req: NextRequest) {
    try {
        if (!DIRECTUS_URL) {
            return NextResponse.json({ error: "NEXT_PUBLIC_API_BASE_URL is not set" }, { status: 500 });
        }

        const userId = decodeUserIdFromJwtCookie(req);
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const payload = {
            price_type_name: body.price_type_name,
            sort: body.sort,
        };

        const url = `${DIRECTUS_URL}/items/${COLLECTION}`;
        const json = await fetchPriceTypeDirectus<{ data: PriceTypeRow }>(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        return NextResponse.json({ data: json.data });
    } catch (error: unknown) {
        return priceTypeErrorResponse(error);
    }
}
