import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

const CCR = "cost_change_requests";

type DirectusMeta = {
    total_count?: number;
};

type DirectusCCRRow = {
    request_id?: number | string | null;
    product_id?:
        | number
        | string
        | {
        product_id?: number | string | null;
        product_code?: string | null;
        product_name?: string | null;
    }
        | null;
    current_cost?: number | string | null;
    proposed_cost?: number | string | null;
    status?: string | null;
    requested_by?: number | string | null;
    requested_at?: string | null;
    approved_by?: number | string | null;
    approved_at?: string | null;
    rejected_by?: number | string | null;
    rejected_at?: string | null;
    reject_reason?: string | null;
};

type DirectusCreateCCRResponse = {
    data: DirectusCCRRow;
};

type DirectusListCCRResponse = {
    data: DirectusCCRRow[];
    meta?: DirectusMeta;
};

type DirectusDupResponse = {
    data: Array<{ request_id?: number | string | null }>;
};

type JwtPayload = {
    sub?: string | number | null;
};

type DirectusWrappedError = {
    message: string;
    status: number;
    url: string;
    body: string;
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

function norm(v: string | null) {
    const s = String(v ?? "").trim();
    if (!s || s === "undefined" || s === "null") return "";
    return s;
}

function unwrapErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

function parseWrappedError(message: string): DirectusWrappedError | null {
    try {
        const parsed: unknown = JSON.parse(message);
        if (!isRecord(parsed)) return null;

        const status = Number(parsed.status);
        const url = typeof parsed.url === "string" ? parsed.url : "";
        const body = typeof parsed.body === "string" ? parsed.body : "";
        const parsedMessage = typeof parsed.message === "string" ? parsed.message : "Directus request failed";

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

export async function GET(req: NextRequest) {
    try {
        mustBase();
        const userId = decodeUserIdFromJwtCookie(req);
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { searchParams } = new URL(req.url);

        const status = norm(searchParams.get("status"));
        const q = norm(searchParams.get("q"));
        const product_id = norm(searchParams.get("product_id"));
        const requested_by = norm(searchParams.get("requested_by"));

        const page = Math.max(1, Number(searchParams.get("page") ?? 1));
        const page_size = Math.min(100, Math.max(10, Number(searchParams.get("page_size") ?? 50)));
        const offset = (page - 1) * page_size;

        const params = new URLSearchParams();
        params.set("limit", String(page_size));
        params.set("offset", String(offset));
        params.set("meta", "total_count");
        params.set("sort", "-requested_at");

        params.set(
            "fields",
            [
                "request_id",
                "product_id",
                "current_cost",
                "proposed_cost",
                "status",
                "requested_by",
                "requested_at",
                "approved_by",
                "approved_at",
                "rejected_by",
                "rejected_at",
                "reject_reason",
                "product_id.product_id",
                "product_id.product_code",
                "product_id.product_name",
            ].join(","),
        );

        let andIdx = 0;
        const addAnd = (suffix: string, value: string) => {
            params.set(`filter[_and][${andIdx}]${suffix}`, value);
            andIdx += 1;
        };

        if (status) addAnd("[status][_eq]", status);
        if (product_id) addAnd("[product_id][_eq]", product_id);
        if (requested_by) addAnd("[requested_by][_eq]", requested_by);

        if (q) {
            addAnd("[_or][0][product_id][product_name][_contains]", q);
            params.set(`filter[_and][${andIdx - 1}][_or][1][product_id][product_code][_contains]`, q);
            params.set(`filter[_and][${andIdx - 1}][_or][2][request_id][_eq]`, q);
        }

        const url = `${mustBase()}/items/${CCR}?${params.toString()}`;
        const json = await fetchDirectus<DirectusListCCRResponse>(url, {
            headers: directusHeaders(),
        });

        return NextResponse.json({
            data: json.data ?? [],
            meta: json.meta ?? null,
        });
    } catch (error: unknown) {
        const message = unwrapErrorMessage(error);
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

export async function POST(req: NextRequest) {
    try {
        mustBase();
        const userId = decodeUserIdFromJwtCookie(req);
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const body = (await req.json()) as Partial<{
            product_id: number;
            proposed_cost: number;
            current_cost?: number;
        }>;

        const product_id = Number(body.product_id);
        const proposed_cost = Number(body.proposed_cost);
        const current_cost = body.current_cost !== undefined ? Number(body.current_cost) : null;

        if (!Number.isFinite(product_id) || product_id <= 0) {
            return NextResponse.json({ error: "product_id is required" }, { status: 400 });
        }
        if (!Number.isFinite(proposed_cost)) {
            return NextResponse.json({ error: "proposed_cost is required" }, { status: 400 });
        }

        const dupParams = new URLSearchParams();
        dupParams.set("limit", "1");
        dupParams.set("fields", "request_id");
        dupParams.set("filter[_and][0][product_id][_eq]", String(product_id));
        dupParams.set("filter[_and][1][status][_eq]", "PENDING");

        const dupUrl = `${mustBase()}/items/${CCR}?${dupParams.toString()}`;
        const dup = await fetchDirectus<DirectusDupResponse>(dupUrl, { headers: directusHeaders() });

        if ((dup.data ?? []).length > 0) {
            return NextResponse.json(
                { error: "A PENDING request already exists for this product." },
                { status: 400 },
            );
        }

        const createUrl = `${mustBase()}/items/${CCR}`;
        const created = await fetchDirectus<DirectusCreateCCRResponse>(createUrl, {
            method: "POST",
            headers: directusHeaders(),
            body: JSON.stringify({
                product_id,
                current_cost,
                proposed_cost,
                status: "PENDING",
                requested_by: userId,
            }),
        });

        return NextResponse.json({ data: created.data }, { status: 201 });
    } catch (error: unknown) {
        const message = unwrapErrorMessage(error);
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
