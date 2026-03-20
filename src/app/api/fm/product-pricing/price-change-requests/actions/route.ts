import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

const PCR = "price_change_requests";
const PRODUCTS = "products";
const PRICE_TYPES = "price_types";
const PPT = "product_per_price_type";

type JwtPayload = {
    sub?: string | number | null;
};

type DirectusWrappedError = {
    message: string;
    status: number;
    url: string;
    body: string;
};

type PcrRow = {
    request_id?: number | string | null;
    product_id?: number | string | null;
    price_type_id?: number | string | null;
    proposed_price?: number | string | null;
    status?: string | null;
    requested_by?: number | string | null;
};

type PriceTypeRow = {
    price_type_id?: number | string | null;
    price_type_name?: string | null;
};

type ProductPerPriceTypeRow = {
    id?: number | string | null;
};

type PatchedPcrResponse = {
    data: PcrRow;
};

type DirectusSingleResponse<T> = {
    data: T;
};

type DirectusListResponse<T> = {
    data: T[];
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

function mapPriceTypeToProductsField(priceTypeName: string) {
    const t = String(priceTypeName ?? "").trim().toUpperCase();
    if (t === "A") return "priceA";
    if (t === "B") return "priceB";
    if (t === "C") return "priceC";
    if (t === "D") return "priceD";
    if (t === "E") return "priceE";
    return null;
}

async function getPcr(request_id: number): Promise<PcrRow | null> {
    const params = new URLSearchParams();
    params.set("fields", "request_id,product_id,price_type_id,proposed_price,status,requested_by");

    const url = `${mustBase()}/items/${PCR}/${request_id}?${params.toString()}`;
    const json = await fetchDirectus<DirectusSingleResponse<PcrRow>>(url, {
        headers: directusHeaders(),
    });

    return json.data ?? null;
}

async function getPriceTypeName(price_type_id: number): Promise<string> {
    const params = new URLSearchParams();
    params.set("fields", "price_type_id,price_type_name");

    const url = `${mustBase()}/items/${PRICE_TYPES}/${price_type_id}?${params.toString()}`;
    const json = await fetchDirectus<DirectusSingleResponse<PriceTypeRow>>(url, {
        headers: directusHeaders(),
    });

    return String(json.data?.price_type_name ?? "");
}

async function upsertProductPerPriceType(args: {
    product_id: number;
    price_type_id: number;
    proposed_price: number;
    userId: number;
}) {
    const { product_id, price_type_id, proposed_price, userId } = args;

    const find = new URLSearchParams();
    find.set("limit", "1");
    find.set("fields", "id");
    find.set("filter[_and][0][product_id][_eq]", String(product_id));
    find.set("filter[_and][1][price_type_id][_eq]", String(price_type_id));

    const findUrl = `${mustBase()}/items/${PPT}?${find.toString()}`;
    const found = await fetchDirectus<DirectusListResponse<ProductPerPriceTypeRow>>(findUrl, {
        headers: directusHeaders(),
    });

    const existingId = Number(found.data?.[0]?.id);

    if (Number.isFinite(existingId) && existingId > 0) {
        const patchUrl = `${mustBase()}/items/${PPT}/${existingId}`;
        await fetchDirectus<unknown>(patchUrl, {
            method: "PATCH",
            headers: directusHeaders(),
            body: JSON.stringify({
                price: proposed_price,
                updated_by: userId,
            }),
        });
        return;
    }

    const createUrl = `${mustBase()}/items/${PPT}`;
    await fetchDirectus<unknown>(createUrl, {
        method: "POST",
        headers: directusHeaders(),
        body: JSON.stringify({
            product_id,
            price_type_id,
            price: proposed_price,
            created_by: userId,
            updated_by: userId,
            status: "final",
        }),
    });
}

async function patchProductPriceField(args: {
    product_id: number;
    field: string;
    proposed_price: number;
}) {
    const { product_id, field, proposed_price } = args;

    const url = `${mustBase()}/items/${PRODUCTS}/${product_id}`;
    await fetchDirectus<unknown>(url, {
        method: "PATCH",
        headers: directusHeaders(),
        body: JSON.stringify({
            [field]: proposed_price,
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

        const pcr = await getPcr(request_id);
        if (!pcr) {
            return NextResponse.json({ error: "Request not found" }, { status: 404 });
        }

        const status = String(pcr.status ?? "");
        if (status !== "PENDING") {
            return NextResponse.json({ error: "Only PENDING requests can be actioned." }, { status: 400 });
        }

        if (action === "cancel") {
            const requested_by = Number(pcr.requested_by);
            if (requested_by !== userId) {
                return NextResponse.json({ error: "You can only cancel your own request." }, { status: 403 });
            }

            const url = `${mustBase()}/items/${PCR}/${request_id}`;
            const updated = await fetchDirectus<PatchedPcrResponse>(url, {
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

            const url = `${mustBase()}/items/${PCR}/${request_id}`;
            const updated = await fetchDirectus<PatchedPcrResponse>(url, {
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

        const product_id = Number(pcr.product_id);
        const price_type_id = Number(pcr.price_type_id);
        const proposed_price = Number(pcr.proposed_price);

        if (!Number.isFinite(product_id) || product_id <= 0) {
            return NextResponse.json({ error: "Invalid product_id on request." }, { status: 400 });
        }

        if (!Number.isFinite(price_type_id) || price_type_id <= 0) {
            return NextResponse.json({ error: "Invalid price_type_id on request." }, { status: 400 });
        }

        if (!Number.isFinite(proposed_price)) {
            return NextResponse.json({ error: "Invalid proposed_price on request." }, { status: 400 });
        }

        const priceTypeName = await getPriceTypeName(price_type_id);
        const productField = mapPriceTypeToProductsField(priceTypeName);

        if (!productField) {
            return NextResponse.json(
                { error: `Unsupported price type name "${priceTypeName}". Expected A–E.` },
                { status: 400 },
            );
        }

        await upsertProductPerPriceType({ product_id, price_type_id, proposed_price, userId });
        await patchProductPriceField({ product_id, field: productField, proposed_price });

        const url = `${mustBase()}/items/${PCR}/${request_id}`;
        const updated = await fetchDirectus<PatchedPcrResponse>(url, {
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