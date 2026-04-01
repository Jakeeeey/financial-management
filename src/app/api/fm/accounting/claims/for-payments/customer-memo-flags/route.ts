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

/**
 * Decode JWT payload (NO VERIFY) and extract numeric userId from `sub`.
 */
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

type BodyPayload = {
    memo_id?: unknown;
    isPending?: unknown;
    isClaimed?: unknown;
};

export async function POST(req: NextRequest) {
    try {
        // ✅ auth
        const userId = decodeUserIdFromJwtCookie(req);
        if (!userId) {
            return NextResponse.json(
                { error: "Unauthorized (missing/invalid token)" },
                { status: 401 }
            );
        }

        const bodyUnknown: unknown = await req.json();
        const body: BodyPayload = isRecord(bodyUnknown) ? (bodyUnknown as BodyPayload) : {};

        const memoId = Number(body?.memo_id);
        const isPending = Number(body?.isPending);
        const isClaimed = Number(body?.isClaimed);

        if (!memoId || !Number.isFinite(memoId)) {
            return NextResponse.json({ error: "memo_id is required" }, { status: 400 });
        }

        // normalize: 0/1 only
        const pending01 = isPending === 1 ? 1 : 0;
        const claimed01 = isClaimed === 1 ? 1 : 0;

        const r = await fetch(`${DIRECTUS_URL}/items/customers_memo/${memoId}`, {
            method: "PATCH",
            headers: directusHeaders(),
            body: JSON.stringify({
                isPending: pending01,
                isClaimed: claimed01,
                updated_by: userId,
            }),
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