import { NextRequest, NextResponse } from "next/server";
import { fetchPriceTypeDirectus, priceTypeErrorResponse } from "../_directus";

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

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        if (!DIRECTUS_URL) {
            return NextResponse.json({ error: "NEXT_PUBLIC_API_BASE_URL is not set" }, { status: 500 });
        }

        const { id } = await params;
        const userId = decodeUserIdFromJwtCookie(req);
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const payload: { price_type_name?: unknown; sort?: unknown; is_active?: boolean } = {};
        if (Object.hasOwn(body, "price_type_name")) payload.price_type_name = body.price_type_name;
        if (Object.hasOwn(body, "sort")) payload.sort = body.sort;
        if (typeof body.is_active === "boolean") payload.is_active = body.is_active;
        if (Object.keys(payload).length === 0) {
            return NextResponse.json({ error: "At least one price type field must be provided." }, { status: 400 });
        }

        const url = `${DIRECTUS_URL}/items/${COLLECTION}/${id}`;
        const json = await fetchPriceTypeDirectus<{ data: PriceTypeRow }>(url, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        return NextResponse.json({ data: json.data });
    } catch (error: unknown) {
        return priceTypeErrorResponse(error);
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        if (!DIRECTUS_URL) {
            return NextResponse.json({ error: "NEXT_PUBLIC_API_BASE_URL is not set" }, { status: 500 });
        }

        const { id } = await params;
        const userId = decodeUserIdFromJwtCookie(req);
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const url = `${DIRECTUS_URL}/items/${COLLECTION}/${id}`;
        await fetchPriceTypeDirectus<unknown>(url, {
            method: "DELETE",
        });

        return NextResponse.json({ ok: true });
    } catch (error: unknown) {
        return priceTypeErrorResponse(error);
    }
}
