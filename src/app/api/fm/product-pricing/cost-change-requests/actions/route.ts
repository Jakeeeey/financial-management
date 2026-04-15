import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

const CCR = "cost_change_requests";
const PRODUCTS = "products";

type JwtPayload = {
    sub?: string | number | null;
};

type DirectusWrappedError = {
    message: string;
    status: number;
    url: string;
    body: string;
};

type CcrRow = {
    request_id?: number | string | null;
    product_id?: number | string | null;
    current_cost?: number | string | null;
    proposed_cost?: number | string | null;
    status?: string | null;
    requested_by?: number | string | null;
};

type PatchedCcrResponse = {
    data: CcrRow;
};

type DirectusSingleResponse<T> = {
    data: T;
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

async function getCcr(request_id: number): Promise<CcrRow | null> {
    const params = new URLSearchParams();
    params.set("fields", "request_id,product_id,current_cost,proposed_cost,status,requested_by");

    const url = `${mustBase()}/items/${CCR}/${request_id}?${params.toString()}`;
    const json = await fetchDirectus<DirectusSingleResponse<CcrRow>>(url, {
        headers: directusHeaders(),
    });

    return json.data ?? null;
}

async function patchProductCostField(args: {
    product_id: number;
    proposed_cost: number;
}) {
    const { product_id, proposed_cost } = args;

    const url = `${mustBase()}/items/${PRODUCTS}/${product_id}`;
    await fetchDirectus<unknown>(url, {
        method: "PATCH",
        headers: directusHeaders(),
        body: JSON.stringify({
            cost_per_unit: proposed_cost,
        }),
    });
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
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const body = (await req.json()) as Partial<{
            action: "approve" | "reject" | "cancel";
            request_id: number;
            reject_reason?: string;
        }>;

        const action = body.action;
        const request_id = Number(body.request_id);

        if (!action) {
            return NextResponse.json({ error: "action is required" }, { status: 400 });
        }

        if (!Number.isFinite(request_id) || request_id <= 0) {
            return NextResponse.json({ error: "request_id is required" }, { status: 400 });
        }

        const ccr = await getCcr(request_id);
        if (!ccr) {
            return NextResponse.json({ error: "Request not found" }, { status: 404 });
        }

        const status = String(ccr.status ?? "");
        if (status !== "PENDING") {
            return NextResponse.json({ error: "Only PENDING requests can be actioned." }, { status: 400 });
        }

        if (action === "cancel") {
            const requested_by = Number(ccr.requested_by);
            if (requested_by !== userId) {
                return NextResponse.json({ error: "You can only cancel your own request." }, { status: 403 });
            }

            const url = `${mustBase()}/items/${CCR}/${request_id}`;
            const updated = await fetchDirectus<PatchedCcrResponse>(url, {
                method: "PATCH",
                headers: directusHeaders(),
                body: JSON.stringify({ status: "CANCELLED" }),
            });

            return NextResponse.json({ data: updated.data });
        }

        if (action === "reject") {
            const reject_reason = String(body.reject_reason ?? "").trim();
            if (!reject_reason) {
                return NextResponse.json({ error: "reject_reason is required" }, { status: 400 });
            }

            const url = `${mustBase()}/items/${CCR}/${request_id}`;
            const updated = await fetchDirectus<PatchedCcrResponse>(url, {
                method: "PATCH",
                headers: directusHeaders(),
                body: JSON.stringify({
                    status: "REJECTED",
                    rejected_by: userId,
                    rejected_at: new Date().toISOString(),
                    reject_reason,
                }),
            });

            return NextResponse.json({ data: updated.data });
        }

        // Action must be approve
        const product_id = Number(ccr.product_id);
        const proposed_cost = Number(ccr.proposed_cost);

        if (!Number.isFinite(product_id) || product_id <= 0) {
            return NextResponse.json({ error: "Invalid product_id on request." }, { status: 400 });
        }

        if (!Number.isFinite(proposed_cost)) {
            return NextResponse.json({ error: "Invalid proposed_cost on request." }, { status: 400 });
        }

        await patchProductCostField({ product_id, proposed_cost });

        const url = `${mustBase()}/items/${CCR}/${request_id}`;
        const updated = await fetchDirectus<PatchedCcrResponse>(url, {
            method: "PATCH",
            headers: directusHeaders(),
            body: JSON.stringify({
                status: "APPROVED",
                approved_by: userId,
                approved_at: new Date().toISOString(),
            }),
        });

        return NextResponse.json({ data: updated.data });
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
