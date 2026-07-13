import { NextRequest, NextResponse } from "next/server";
import {
    MatrixSetupError,
    initializeMissingMatrixRow,
    rollbackMatrixInitialization,
} from "../_matrixSetup";
import { assertValidPriceValue, isInvalidPriceValueError } from "../_pricePrecision";
import { CHUNK_SIZE } from "../_supplierFilters";

const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

const PRICE_TYPES = "price_types";
const PRICES = "product_per_price_type";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function deprecatedJson(body: unknown, init?: ResponseInit) {
    const response = NextResponse.json(body, init);
    response.headers.set("Deprecation", "true");
    response.headers.set("Link", '</api/fm/product-pricing/matrix-setup>; rel="successor-version"');
    response.headers.set(
        "Warning",
        '299 - "prices-upsert is deprecated; use matrix-setup for initial records and price-change requests for updates."',
    );
    return response;
}

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
    sort?: number | string | null;
};

type ExistingPriceRow = {
    id?: number | string | null;
    product_id?: number | string | null;
    price_type_id?: number | string | null;
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

export async function POST(req: NextRequest) {
    try {
        if (!DIRECTUS_URL) {
            return deprecatedJson({ error: "NEXT_PUBLIC_API_BASE_URL is not set" }, { status: 500 });
        }

        const userId = decodeUserIdFromJwtCookie(req);
        if (!userId) {
            return deprecatedJson({ error: "Unauthorized (missing/invalid token)" }, { status: 401 });
        }

        const body = (await req.json()) as { lines?: UpsertLine[] };
        const lines = Array.isArray(body?.lines) ? body.lines : [];

        if (!lines.length) {
            return deprecatedJson({ ok: true, affected: 0 });
        }

        for (const line of lines) {
            const pid = Number(line.product_id);
            const ptid = Number(line.price_type_id);

            if (!pid || Number.isNaN(pid) || !ptid || Number.isNaN(ptid)) {
                return deprecatedJson({ error: "Invalid product_id / price_type_id" }, { status: 400 });
            }

            if (line.price !== null && line.price !== undefined) {
                assertValidPriceValue(line.price, "price");
            }
        }

        const priceTypeParams = new URLSearchParams();
        priceTypeParams.set("limit", "-1");
        priceTypeParams.set("fields", "price_type_id,price_type_name,sort");
        priceTypeParams.set("sort", "sort,price_type_id");

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
                return deprecatedJson(
                    { error: `price_type_id not found: ${line.price_type_id}` },
                    { status: 400 },
                );
            }
        }

        const productIds = Array.from(new Set(lines.map((line) => Number(line.product_id))));
        const priceTypeIds = Array.from(new Set(lines.map((line) => Number(line.price_type_id))));

        const existingKeyToId = new Map<string, number>();
        const productIdChunks = [];
        for (let i = 0; i < productIds.length; i += CHUNK_SIZE) {
            productIdChunks.push(productIds.slice(i, i + CHUNK_SIZE));
        }
        for (const pidChunk of productIdChunks) {
            const ptidChunks = [];
            for (let i = 0; i < priceTypeIds.length; i += CHUNK_SIZE) {
                ptidChunks.push(priceTypeIds.slice(i, i + CHUNK_SIZE));
            }
            for (const ptidChunk of ptidChunks) {
                const existingParams = new URLSearchParams();
                existingParams.set("limit", "-1");
                existingParams.set("fields", "id,product_id,price_type_id");
                existingParams.set("filter[product_id][_in]", pidChunk.join(","));
                existingParams.set("filter[price_type_id][_in]", ptidChunk.join(","));

                const existingUrl = `${DIRECTUS_URL}/items/${PRICES}?${existingParams.toString()}`;
                const existingJson = await fetchDirectus<{ data: ExistingPriceRow[] }>(existingUrl);

                for (const row of existingJson.data ?? []) {
                    const key = `${Number(row.product_id)}:${Number(row.price_type_id)}`;
                    existingKeyToId.set(key, Number(row.id));
                }
            }
        }

        const existingTargets = Array.from(
            new Map(
                lines
                    .map((line) => ({
                        product_id: Number(line.product_id),
                        price_type_id: Number(line.price_type_id),
                    }))
                    .filter((target) =>
                        existingKeyToId.has(`${target.product_id}:${target.price_type_id}`),
                    )
                    .map((target) => [
                        `${target.product_id}:${target.price_type_id}`,
                        target,
                    ]),
            ).values(),
        );
        if (existingTargets.length > 0) {
            return deprecatedJson(
                {
                    error: "Existing price-matrix records must be updated through a price-change request.",
                    code: "existing_price_requires_change_request",
                    migration_required: true,
                    successors: {
                        initialize: "/api/fm/product-pricing/matrix-setup",
                        request_change: "/api/fm/product-pricing/price-change-batches",
                    },
                    targets: existingTargets,
                },
                { status: 409 },
            );
        }

        const uniqueLines = Array.from(
            new Map(
                lines.map((line) => [
                    `${Number(line.product_id)}:${Number(line.price_type_id)}`,
                    line,
                ]),
            ).values(),
        );
        const completed = [];

        try {
            for (const line of uniqueLines) {
                completed.push(await initializeMissingMatrixRow({
                    userId,
                    productId: Number(line.product_id),
                    priceTypeId: Number(line.price_type_id),
                    initialPrice: line.price ?? null,
                }));
            }
        } catch (setupError: unknown) {
            const rollbackFailures: Array<{ id: number; product_id: number; error: string }> = [];
            for (const receipt of [...completed].reverse()) {
                try {
                    await rollbackMatrixInitialization(receipt);
                } catch (rollbackError: unknown) {
                    rollbackFailures.push({
                        id: receipt.id,
                        product_id: receipt.productId,
                        error: rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
                    });
                }
            }

            if (rollbackFailures.length > 0) {
                return deprecatedJson(
                    {
                        error: "Bulk matrix setup partially completed and requires reconciliation.",
                        code: "price_matrix_bulk_partial_failure",
                        failures: rollbackFailures,
                    },
                    { status: 500 },
                );
            }
            if (setupError instanceof MatrixSetupError) {
                return deprecatedJson(
                    { error: setupError.message, code: setupError.code, ...setupError.data },
                    { status: setupError.status },
                );
            }
            throw setupError;
        }

        return deprecatedJson({ ok: true, affected: completed.length });
    } catch (error: unknown) {
        if (isInvalidPriceValueError(error)) {
            return deprecatedJson({ error: error.message }, { status: 400 });
        }

        return deprecatedJson(
            {
                error: "Unexpected error",
                details: error instanceof Error ? error.message : String(error),
            },
            { status: 500 },
        );
    }
}
