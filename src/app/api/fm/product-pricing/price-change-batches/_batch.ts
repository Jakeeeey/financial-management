import { NextRequest, NextResponse } from "next/server";

export const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

export const HEADERS = "price_change_headers";
export const DETAILS = "price_change_requests";
export const PRODUCTS = "products";
export const PRICE_TYPES = "price_types";
export const PRICES = "product_per_price_type";

type JwtPayload = {
    sub?: string | number | null;
};

export type DirectusWrappedError = {
    message: string;
    status: number;
    url: string;
    body: string;
};

export type BatchHeaderRow = {
    id?: number | string | null;
    header_id?: number | string | null;
    supplier_id?: number | string | { id?: number | string | null; supplier_name?: string | null; supplier_shortcut?: string | null } | null;
    reference_no?: string | null;
    remarks?: string | null;
    status?: string | null;
    requested_by?: number | string | null;
    requested_at?: string | null;
    approved_by?: number | string | null;
    approved_at?: string | null;
    rejected_by?: number | string | null;
    rejected_at?: string | null;
    reject_reason?: string | null;
};

export type BatchDetailRow = {
    request_id?: number | string | null;
    header_id?: number | string | BatchHeaderRow | null;
    product_id?:
        | number
        | string
        | {
            product_id?: number | string | null;
            product_code?: string | null;
            product_name?: string | null;
            barcode?: string | null;
        }
        | null;
    price_type_id?:
        | number
        | string
        | {
            price_type_id?: number | string | null;
            price_type_name?: string | null;
        }
        | null;
    current_price?: number | string | null;
    proposed_price?: number | string | null;
    status?: string | null;
    requested_by?: number | string | null;
    requested_at?: string | null;
};

type PriceTypeRow = {
    price_type_id?: number | string | null;
    price_type_name?: string | null;
};

type ExistingPriceRow = {
    id?: number | string | null;
    product_id?: number | string | null;
    price_type_id?: number | string | null;
};

type DirectusSingle<T> = { data?: T };
type DirectusList<T> = { data?: T[]; meta?: { total_count?: number } | null };

export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

export function mustBase() {
    if (!DIRECTUS_URL) throw new Error("NEXT_PUBLIC_API_BASE_URL is not set.");
    return DIRECTUS_URL;
}

export function directusToken() {
    return process.env.DIRECTUS_STATIC_TOKEN || process.env.DIRECTUS_SERVICE_TOKEN || "";
}

export function directusHeaders() {
    const token = directusToken();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
}

export async function fetchDirectus<T>(url: string, init?: RequestInit): Promise<T> {
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

export function decodeUserIdFromJwtCookie(req: NextRequest, cookieName = "vos_access_token") {
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

export function nowManila(): string {
    return new Date()
        .toLocaleString("sv-SE", { timeZone: "Asia/Manila" })
        .replace(" ", "T");
}

export function pickId(value: unknown): number | null {
    if (value === null || value === undefined) return null;
    if (typeof value === "number") return Number.isFinite(value) && value > 0 ? value : null;
    if (typeof value === "string") {
        const n = Number(value);
        return Number.isFinite(n) && n > 0 ? n : null;
    }
    if (isRecord(value)) {
        for (const key of ["header_id", "request_id", "product_id", "price_type_id", "id"]) {
            const n = Number(value[key]);
            if (Number.isFinite(n) && n > 0) return n;
        }
    }
    return null;
}

export function normalizeHeaderId(header: BatchHeaderRow): number {
    return pickId(header.header_id) ?? pickId(header.id) ?? 0;
}

export function normalizeProductId(detail: BatchDetailRow): number {
    return pickId(detail.product_id) ?? 0;
}

export function normalizePriceTypeId(detail: BatchDetailRow): number {
    return pickId(detail.price_type_id) ?? 0;
}

export function normalizePriceTypeName(value: unknown): string {
    if (isRecord(value)) return String(value.price_type_name ?? "").trim();
    return "";
}

export function parseWrappedError(message: string): DirectusWrappedError | null {
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

export function directusErrorResponse(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const wrapped = parseWrappedError(message);

    if (wrapped) {
        const isBatchStorageRequest =
            wrapped.url.includes(`/items/${HEADERS}`) ||
            wrapped.url.includes(`/items/${DETAILS}`) ||
            wrapped.body.includes(HEADERS) ||
            wrapped.body.includes(DETAILS);

        if ((wrapped.status === 401 || wrapped.status === 403 || wrapped.status === 404) && isBatchStorageRequest) {
            return NextResponse.json(
                {
                    error: "Price change batch storage is not configured or the Directus token lacks permission.",
                    details: `Confirm ${HEADERS} exists, ${DETAILS} has header_id/current_price fields, and the Directus token role can read/create/update both collections.`,
                    setup_required: true,
                    directus_status: wrapped.status,
                },
                { status: 503 },
            );
        }

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

export function mapPriceTypeToProductsPatch(priceTypeName: string, price: number) {
    const normalized = String(priceTypeName ?? "")
        .trim()
        .toUpperCase()
        .replace(/[_-]+/g, " ");

    if (normalized === "A" || normalized === "PRICE A" || normalized === "TIER A") {
        return { priceA: price, price_per_unit: price };
    }
    if (normalized === "B" || normalized === "PRICE B" || normalized === "TIER B") return { priceB: price };
    if (normalized === "C" || normalized === "PRICE C" || normalized === "TIER C") return { priceC: price };
    if (normalized === "D" || normalized === "PRICE D" || normalized === "TIER D") return { priceD: price };
    if (normalized === "E" || normalized === "PRICE E" || normalized === "TIER E") return { priceE: price };
    if (normalized === "LIST" || normalized === "LIST PRICE" || normalized === "PRICE PER UNIT") {
        return { price_per_unit: price };
    }
    return null;
}

export async function getHeader(headerId: number) {
    const params = new URLSearchParams();
    params.set(
        "fields",
        [
            "header_id",
            "supplier_id",
            "supplier_id.id",
            "supplier_id.supplier_name",
            "supplier_id.supplier_shortcut",
            "reference_no",
            "remarks",
            "status",
            "requested_by",
            "requested_at",
            "approved_by",
            "approved_at",
            "rejected_by",
            "rejected_at",
            "reject_reason",
        ].join(","),
    );

    const url = `${mustBase()}/items/${HEADERS}/${headerId}?${params.toString()}`;
    const json = await fetchDirectus<DirectusSingle<BatchHeaderRow>>(url, { headers: directusHeaders() });
    return json.data ?? null;
}

export async function getDetails(headerId: number) {
    const params = new URLSearchParams();
    params.set("limit", "-1");
    params.set(
        "fields",
        [
            "request_id",
            "header_id",
            "product_id",
            "product_id.product_id",
            "product_id.product_code",
            "product_id.product_name",
            "product_id.barcode",
            "price_type_id",
            "price_type_id.price_type_id",
            "price_type_id.price_type_name",
            "current_price",
            "proposed_price",
            "status",
            "requested_by",
            "requested_at",
        ].join(","),
    );
    params.set("filter[header_id][_eq]", String(headerId));
    params.set("sort", "request_id");

    const url = `${mustBase()}/items/${DETAILS}?${params.toString()}`;
    const json = await fetchDirectus<DirectusList<BatchDetailRow>>(url, { headers: directusHeaders() });
    return json.data ?? [];
}

async function getPriceTypeNames(priceTypeIds: number[]) {
    const ids = Array.from(new Set(priceTypeIds.filter((id) => Number.isFinite(id) && id > 0)));
    if (!ids.length) return new Map<number, string>();

    const params = new URLSearchParams();
    params.set("limit", "-1");
    params.set("fields", "price_type_id,price_type_name");
    params.set("filter[price_type_id][_in]", ids.join(","));

    const url = `${mustBase()}/items/${PRICE_TYPES}?${params.toString()}`;
    const json = await fetchDirectus<DirectusList<PriceTypeRow>>(url, { headers: directusHeaders() });

    const map = new Map<number, string>();
    for (const row of json.data ?? []) {
        const id = Number(row.price_type_id);
        const name = String(row.price_type_name ?? "").trim();
        if (Number.isFinite(id) && id > 0 && name) map.set(id, name);
    }
    return map;
}

async function fetchExistingPrices(productIds: number[], priceTypeIds: number[]) {
    if (!productIds.length || !priceTypeIds.length) return new Map<string, number>();

    const params = new URLSearchParams();
    params.set("limit", "-1");
    params.set("fields", "id,product_id,price_type_id");
    params.set("filter[product_id][_in]", productIds.join(","));
    params.set("filter[price_type_id][_in]", priceTypeIds.join(","));

    const url = `${mustBase()}/items/${PRICES}?${params.toString()}`;
    const json = await fetchDirectus<DirectusList<ExistingPriceRow>>(url, { headers: directusHeaders() });

    const map = new Map<string, number>();
    for (const row of json.data ?? []) {
        const productId = Number(row.product_id);
        const priceTypeId = Number(row.price_type_id);
        const id = Number(row.id);
        if (Number.isFinite(productId) && Number.isFinite(priceTypeId) && Number.isFinite(id) && id > 0) {
            map.set(`${productId}:${priceTypeId}`, id);
        }
    }
    return map;
}

export async function applyApprovedBatch(headerId: number, userId: number) {
    const header = await getHeader(headerId);
    if (!header) {
        return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    }

    const status = String(header.status ?? "");
    if (status !== "PENDING") {
        return NextResponse.json({ error: "Only PENDING batches can be approved." }, { status: 400 });
    }

    const details = await getDetails(headerId);
    if (details.length === 0) {
        return NextResponse.json({ error: "Batch has no detail lines." }, { status: 400 });
    }

    const normalizedDetails = details.map((line) => ({
        requestId: pickId(line.request_id) ?? 0,
        productId: normalizeProductId(line),
        priceTypeId: normalizePriceTypeId(line),
        proposedPrice: Number(line.proposed_price),
    }));

    for (const line of normalizedDetails) {
        if (!line.productId || !line.priceTypeId || !Number.isFinite(line.proposedPrice)) {
            return NextResponse.json({ error: "Batch contains an invalid detail line." }, { status: 400 });
        }
    }

    const productIds = Array.from(new Set(normalizedDetails.map((line) => line.productId)));
    const priceTypeIds = Array.from(new Set(normalizedDetails.map((line) => line.priceTypeId)));
    const [existingPrices, priceTypeNames] = await Promise.all([
        fetchExistingPrices(productIds, priceTypeIds),
        getPriceTypeNames(priceTypeIds),
    ]);

    for (const line of normalizedDetails) {
        const key = `${line.productId}:${line.priceTypeId}`;
        const existingId = existingPrices.get(key);
        const payload = {
            status: "draft",
            product_id: line.productId,
            price_type_id: line.priceTypeId,
            price: line.proposedPrice,
            updated_by: userId,
            updated_at: nowManila(),
        };

        if (existingId) {
            await fetchDirectus(`${mustBase()}/items/${PRICES}/${existingId}`, {
                method: "PATCH",
                headers: directusHeaders(),
                body: JSON.stringify(payload),
            });
        } else {
            await fetchDirectus(`${mustBase()}/items/${PRICES}`, {
                method: "POST",
                headers: directusHeaders(),
                body: JSON.stringify({ ...payload, created_by: userId }),
            });
        }

        const productPatch = mapPriceTypeToProductsPatch(priceTypeNames.get(line.priceTypeId) ?? "", line.proposedPrice);
        if (productPatch) {
            await fetchDirectus(`${mustBase()}/items/${PRODUCTS}/${line.productId}`, {
                method: "PATCH",
                headers: directusHeaders(),
                body: JSON.stringify({
                    ...productPatch,
                    last_updated: nowManila(),
                    updated_by: userId,
                }),
            });
        }
    }

    await fetchDirectus(`${mustBase()}/items/${HEADERS}/${headerId}`, {
        method: "PATCH",
        headers: directusHeaders(),
        body: JSON.stringify({
            status: "APPROVED",
            approved_by: userId,
            approved_at: nowManila(),
        }),
    });

    await Promise.all(
        normalizedDetails
            .filter((line) => line.requestId > 0)
            .map((line) =>
                fetchDirectus(`${mustBase()}/items/${DETAILS}/${line.requestId}`, {
                    method: "PATCH",
                    headers: directusHeaders(),
                    body: JSON.stringify({ status: "APPROVED" }),
                }),
            ),
    );

    return NextResponse.json({ ok: true, header_id: headerId, affected: normalizedDetails.length });
}
