import { NextRequest, NextResponse } from "next/server";

const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

const PRICE_TYPES = "price_types";
const PRICES = "product_per_price_type";
const PRODUCTS = "products";

type UpsertLine = {
    product_id: number;
    price_type_id: number;
    price: number | null;
    status?: string;
};

type JwtPayload = {
    sub?: string | number | null;
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

type PriceRecordPayload = {
    status: string;
    product_id: number;
    price_type_id: number;
    price: number | null;
    updated_by: number;
};

type CreatePriceRecordPayload = PriceRecordPayload & {
    created_by: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

async function fetchDirectus<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, { cache: "no-store", ...init });
    if (!res.ok) throw new Error(await res.text());
    return (await res.json()) as T;
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

        if (!isRecord(payloadUnknown)) return null;

        const payload = payloadUnknown as JwtPayload;
        const userId = Number(payload.sub);
        return Number.isFinite(userId) ? userId : null;
    } catch {
        return null;
    }
}

function tierToProductPatch(tierName: string, price: number | null) {
    const tier = String(tierName ?? "").trim().toUpperCase();

    if (tier === "A") return { priceA: price, price_per_unit: price };
    if (tier === "B") return { priceB: price };
    if (tier === "C") return { priceC: price };
    if (tier === "D") return { priceD: price };
    if (tier === "E") return { priceE: price };
    return null;
}

export async function POST(req: NextRequest) {
    try {
        if (!DIRECTUS_URL) {
            return NextResponse.json({ error: "NEXT_PUBLIC_API_BASE_URL is not set" }, { status: 500 });
        }

        const userId = decodeUserIdFromJwtCookie(req);
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized (missing/invalid token)" }, { status: 401 });
        }

        const body = (await req.json()) as { lines?: UpsertLine[] };
        const lines = Array.isArray(body?.lines) ? body.lines : [];

        if (!lines.length) {
            return NextResponse.json({ ok: true, affected: 0 });
        }

        for (const line of lines) {
            const pid = Number(line.product_id);
            const ptid = Number(line.price_type_id);

            if (!pid || Number.isNaN(pid) || !ptid || Number.isNaN(ptid)) {
                return NextResponse.json({ error: "Invalid product_id / price_type_id" }, { status: 400 });
            }

            if (line.price !== null && line.price !== undefined) {
                const price = Number(line.price);

                if (!Number.isFinite(price)) {
                    return NextResponse.json({ error: "Invalid price value" }, { status: 400 });
                }

                if (price < 0) {
                    return NextResponse.json({ error: "Price cannot be negative" }, { status: 400 });
                }
            }
        }

        const priceTypeParams = new URLSearchParams();
        priceTypeParams.set("limit", "-1");
        priceTypeParams.set("fields", "price_type_id,price_type_name");

        const priceTypeUrl = `${DIRECTUS_URL}/items/${PRICE_TYPES}?${priceTypeParams.toString()}`;
        const priceTypeJson = await fetchDirectus<{ data: PriceTypeRow[] }>(priceTypeUrl);

        const idToTier = new Map<number, string>();
        for (const row of priceTypeJson.data ?? []) {
            const id = Number(row.price_type_id);
            const name = String(row.price_type_name ?? "").trim();
            if (Number.isFinite(id) && name) {
                idToTier.set(id, name);
            }
        }

        for (const line of lines) {
            if (!idToTier.has(Number(line.price_type_id))) {
                return NextResponse.json(
                    { error: `price_type_id not found: ${line.price_type_id}` },
                    { status: 400 },
                );
            }
        }

        const productIds = Array.from(new Set(lines.map((line) => Number(line.product_id))));
        const priceTypeIds = Array.from(new Set(lines.map((line) => Number(line.price_type_id))));

        const existingParams = new URLSearchParams();
        existingParams.set("limit", "-1");
        existingParams.set("fields", "id,product_id,price_type_id");
        existingParams.set("filter[product_id][_in]", productIds.join(","));
        existingParams.set("filter[price_type_id][_in]", priceTypeIds.join(","));

        const existingUrl = `${DIRECTUS_URL}/items/${PRICES}?${existingParams.toString()}`;
        const existingJson = await fetchDirectus<{ data: ExistingPriceRow[] }>(existingUrl);

        const existingKeyToId = new Map<string, number>();
        for (const row of existingJson.data ?? []) {
            const key = `${Number(row.product_id)}:${Number(row.price_type_id)}`;
            existingKeyToId.set(key, Number(row.id));
        }

        const toCreate: CreatePriceRecordPayload[] = [];
        const toUpdate: Array<{ id: number; payload: PriceRecordPayload }> = [];

        for (const line of lines) {
            const pid = Number(line.product_id);
            const ptid = Number(line.price_type_id);
            const key = `${pid}:${ptid}`;

            const payload: PriceRecordPayload = {
                status: (line.status ?? "draft").trim() || "draft",
                product_id: pid,
                price_type_id: ptid,
                price: line.price === null || line.price === undefined ? null : Number(line.price),
                updated_by: userId,
            };

            const existingId = existingKeyToId.get(key);
            if (existingId) {
                toUpdate.push({ id: existingId, payload });
            } else {
                toCreate.push({ ...payload, created_by: userId });
            }
        }

        let affected = 0;

        if (toCreate.length) {
            const createUrl = `${DIRECTUS_URL}/items/${PRICES}`;
            const res = await fetchDirectus<{ data: ExistingPriceRow[] }>(createUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(toCreate),
            });
            affected += (res.data ?? []).length;
        }

        if (toUpdate.length) {
            await Promise.all(
                toUpdate.map(({ id, payload }) =>
                    fetchDirectus<unknown>(`${DIRECTUS_URL}/items/${PRICES}/${id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(payload),
                    }),
                ),
            );
            affected += toUpdate.length;
        }

        const syncOps = lines
            .map((line) => {
                const pid = Number(line.product_id);
                const ptid = Number(line.price_type_id);
                const tierName = idToTier.get(ptid) ?? "";
                const patch = tierToProductPatch(
                    tierName,
                    line.price === null || line.price === undefined ? null : Number(line.price),
                );

                if (!patch) return null;

                return fetchDirectus<unknown>(`${DIRECTUS_URL}/items/${PRODUCTS}/${pid}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(patch),
                });
            })
            .filter((op): op is Promise<unknown> => op !== null);

        if (syncOps.length) {
            await Promise.all(syncOps);
        }

        return NextResponse.json({ ok: true, affected });
    } catch (error: unknown) {
        return NextResponse.json(
            {
                error: "Unexpected error",
                details: error instanceof Error ? error.message : String(error),
            },
            { status: 500 },
        );
    }
}