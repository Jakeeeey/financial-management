import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

const CCR = "cost_change_requests";

type BulkRequestItem = {
    product_id: number;
    proposed_cost: number;
    current_cost?: number | null;
};

type DirectusWrappedError = {
    message: string;
    status: number;
    url: string;
    body: string;
};

type DirectusDuplicateRow = {
    request_id?: number | string | null;
};

type DirectusBulkCreateRow = {
    request_id?: number | string | null;
};

type JwtPayload = {
    sub?: string | number | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function mustBase() {
    if (!DIRECTUS_URL) throw new Error("NEXT_PUBLIC_API_BASE_URL is not set.");
    return DIRECTUS_URL;
}

function directusToken() {
    return process.env.DIRECTUS_STATIC_TOKEN || process.env.DIRECTUS_SERVICE_TOKEN || "";
}

function directusHeaders() {
    const token = directusToken();
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (token) h.Authorization = `Bearer ${token}`;
    return h;
}

async function fetchDirectus<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, { cache: "no-store", ...init });
    const text = await res.text().catch(() => "");

    if (!res.ok) {
        throw new Error(
            JSON.stringify({
                message: "Directus request failed",
                status: res.status,
                url,
                body: text,
            } satisfies DirectusWrappedError),
        );
    }

    return text ? (JSON.parse(text) as T) : ({} as T);
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

function parseWrappedError(message: string): DirectusWrappedError | null {
    try {
        const parsed: unknown = JSON.parse(message);
        if (!isRecord(parsed)) return null;

        const status = Number(parsed.status);
        const url = typeof parsed.url === "string" ? parsed.url : "";
        const body = typeof parsed.body === "string" ? parsed.body : "";
        const parsedMessage =
            typeof parsed.message === "string" ? parsed.message : "Directus request failed";

        if (!Number.isFinite(status) || !url) return null;

        return {
            message: parsedMessage,
            status,
            url,
            body,
        };
    } catch {
        return null;
    }
}

export async function POST(req: NextRequest) {
    try {
        mustBase();

        const userId = decodeUserIdFromJwtCookie(req);
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = (await req.json()) as Partial<{
            items: BulkRequestItem[];
        }>;

        const rawItems = Array.isArray(body.items) ? body.items : [];

        if (rawItems.length === 0) {
            return NextResponse.json({ error: "items must be a non-empty array" }, { status: 400 });
        }

        const seen = new Set<number>();
        const items: BulkRequestItem[] = [];
        let skipped_duplicates = 0;

        for (const item of rawItems) {
            const product_id = Number(item.product_id);
            const proposed_cost = Number(item.proposed_cost);
            const current_cost = item.current_cost !== undefined ? Number(item.current_cost) : null;

            if (!Number.isFinite(product_id) || product_id <= 0) continue;
            if (!Number.isFinite(proposed_cost)) continue;

            if (seen.has(product_id)) {
                skipped_duplicates += 1;
                continue;
            }

            seen.add(product_id);
            items.push({ product_id, proposed_cost, current_cost });
        }

        if (items.length === 0) {
            return NextResponse.json({ error: "No valid items to process" }, { status: 400 });
        }

        const toCreate: BulkRequestItem[] = [];
        let skipped_existing_pending = 0;

        for (const item of items) {
            const dupParams = new URLSearchParams();
            dupParams.set("limit", "1");
            dupParams.set("fields", "request_id");
            dupParams.set("filter[_and][0][product_id][_eq]", String(item.product_id));
            dupParams.set("filter[_and][1][status][_eq]", "PENDING");

            const dupUrl = `${mustBase()}/items/${CCR}?${dupParams.toString()}`;
            const dup = await fetchDirectus<{ data: DirectusDuplicateRow[] }>(dupUrl, {
                headers: directusHeaders(),
            });

            if ((dup.data ?? []).length > 0) {
                skipped_existing_pending += 1;
                continue;
            }

            toCreate.push(item);
        }

        if (toCreate.length === 0) {
            return NextResponse.json(
                {
                    created: 0,
                    skipped_duplicates,
                    skipped_existing_pending,
                },
                { status: 200 },
            );
        }

        const payload = toCreate.map((item) => ({
            product_id: item.product_id,
            current_cost: item.current_cost,
            proposed_cost: item.proposed_cost,
            status: "PENDING",
            requested_by: userId,
        }));

        const createUrl = `${mustBase()}/items/${CCR}`;
        const created = await fetchDirectus<{ data: DirectusBulkCreateRow[] }>(createUrl, {
            method: "POST",
            headers: directusHeaders(),
            body: JSON.stringify(payload),
        });

        return NextResponse.json(
            {
                created: (created.data ?? []).length,
                skipped_duplicates,
                skipped_existing_pending,
            },
            { status: 201 },
        );
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        const wrapped = parseWrappedError(message);

        if (wrapped) {
            return NextResponse.json(
                {
                    error: "Directus request failed",
                    directus_status: wrapped.status,
                    directus_url: wrapped.url,
                    directus_body: wrapped.body,
                },
                { status: 500 },
            );
        }

        return NextResponse.json({ error: "Unexpected error", details: message }, { status: 500 });
    }
}
