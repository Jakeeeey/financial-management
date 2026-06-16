import { NextRequest, NextResponse } from "next/server";
import {
    type LegacyPriceTypeRow,
    resolveLegacyProductsPatch,
} from "../_legacyProductPriceSync";
import { invalidateGroupIndexCacheOnCatalogChange } from "../_productGroupIndexCache";

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
    sort?: number | string | null;
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

const BATCH_PAGE_SIZE = 500;
const IN_CHUNK_SIZE = 200;

function chunkArray<T>(arr: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
}

async function fetchAllPagesLocal<T>(
    collection: string,
    buildParams: () => URLSearchParams,
): Promise<T[]> {
    const all: T[] = [];
    let offset = 0;

    while (true) {
        const params = buildParams();
        params.set("limit", String(BATCH_PAGE_SIZE));
        params.set("offset", String(offset));

        const url = `${mustBase()}/items/${collection}?${params.toString()}`;
        const json = await fetchDirectus<DirectusList<T>>(url, { headers: directusHeaders() });
        const rows = json.data ?? [];
        all.push(...rows);

        if (rows.length < BATCH_PAGE_SIZE) break;
        offset += BATCH_PAGE_SIZE;
    }

    return all;
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

export type BatchCreateLineInput = {
    product_id: number;
    price_type_id: number;
    current_price?: number | null;
    proposed_price: number;
};

export type NormalizedBatchCreateLine = {
    product_id: number;
    price_type_id: number;
    current_price: number | null;
    proposed_price: number;
};

export type BatchCreatePlan = {
    linesToCreate: NormalizedBatchCreateLine[];
    skippedDuplicates: number;
    skippedExistingPending: number;
};

function batchLineKey(productId: number, priceTypeId: number) {
    return `${productId}:${priceTypeId}`;
}

function supplierIdOf(value: unknown): number | null {
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (typeof value === "string") {
        const n = Number(value);
        return Number.isFinite(n) ? n : null;
    }
    if (isRecord(value)) return pickId(value.id);
    return null;
}

function supplierNameOf(value: unknown): string {
    if (!isRecord(value)) return "";
    const shortcut = String(value.supplier_shortcut ?? "").trim();
    const name = String(value.supplier_name ?? "").trim();
    return shortcut && name ? `${shortcut} - ${name}` : name || shortcut;
}

export function mapBatchHeaderResponse(row: BatchHeaderRow, lineCount = 0) {
    const headerId = normalizeHeaderId(row);
    const supplierId = supplierIdOf(row.supplier_id);
    return {
        id: headerId,
        header_id: headerId,
        supplier_id: supplierId,
        supplier_name: supplierNameOf(row.supplier_id),
        reference_no: row.reference_no ?? "",
        remarks: row.remarks ?? "",
        status: row.status ?? "PENDING",
        requested_by: row.requested_by ?? null,
        requested_at: row.requested_at ?? null,
        approved_by: row.approved_by ?? null,
        approved_at: row.approved_at ?? null,
        rejected_by: row.rejected_by ?? null,
        rejected_at: row.rejected_at ?? null,
        reject_reason: row.reject_reason ?? null,
        line_count: lineCount,
    };
}

export async function getExistingPendingBatchKeys(lines: NormalizedBatchCreateLine[]) {
    const productIds = Array.from(new Set(lines.map((line) => line.product_id)));
    const priceTypeIds = Array.from(new Set(lines.map((line) => line.price_type_id)));

    if (!productIds.length || !priceTypeIds.length) return new Set<string>();

    const keys = new Set<string>();
    const productChunks = chunkArray(productIds, IN_CHUNK_SIZE);

    for (const productChunk of productChunks) {
        const rows = await fetchAllPagesLocal<BatchDetailRow>(DETAILS, () => {
            const params = new URLSearchParams();
            params.set("fields", "request_id,product_id,price_type_id");
            params.set("filter[_and][0][status][_eq]", "PENDING");
            params.set("filter[_and][1][product_id][_in]", productChunk.join(","));
            params.set("filter[_and][2][price_type_id][_in]", priceTypeIds.join(","));
            return params;
        });

        for (const row of rows) {
            const productId = normalizeProductId(row);
            const priceTypeId = normalizePriceTypeId(row);
            if (productId > 0 && priceTypeId > 0) {
                keys.add(batchLineKey(productId, priceTypeId));
            }
        }
    }

    return keys;
}

export async function normalizeBatchCreateLines(rawLines: BatchCreateLineInput[]): Promise<BatchCreatePlan> {
    const seen = new Set<string>();
    const normalizedLines: NormalizedBatchCreateLine[] = [];
    let skippedDuplicates = 0;

    for (const line of rawLines) {
        const productId = Number(line.product_id);
        const priceTypeId = Number(line.price_type_id);
        const currentPrice =
            line.current_price === null || line.current_price === undefined ? null : Number(line.current_price);
        const proposedPrice = Number(line.proposed_price);

        if (!Number.isFinite(productId) || productId <= 0) continue;
        if (!Number.isFinite(priceTypeId) || priceTypeId <= 0) continue;
        if (!Number.isFinite(proposedPrice) || proposedPrice < 0) continue;

        const key = batchLineKey(productId, priceTypeId);
        if (seen.has(key)) {
            skippedDuplicates += 1;
            continue;
        }
        seen.add(key);

        normalizedLines.push({
            product_id: productId,
            price_type_id: priceTypeId,
            current_price: Number.isFinite(currentPrice) ? currentPrice : null,
            proposed_price: proposedPrice,
        });
    }

    const existingPendingKeys = await getExistingPendingBatchKeys(normalizedLines);
    const linesToCreate = normalizedLines.filter(
        (line) => !existingPendingKeys.has(batchLineKey(line.product_id, line.price_type_id)),
    );
    const skippedExistingPending = normalizedLines.length - linesToCreate.length;

    return {
        linesToCreate,
        skippedDuplicates,
        skippedExistingPending,
    };
}

export async function createPendingPriceBatch(args: {
    userId: number;
    supplierId: number;
    referenceNo: string;
    remarks: string;
    linesToCreate: NormalizedBatchCreateLine[];
}) {
    const { userId, supplierId, referenceNo, remarks, linesToCreate } = args;

    if (linesToCreate.length === 0) {
        throw new Error("linesToCreate must be non-empty");
    }

    const headerPayload = {
        supplier_id: supplierId,
        reference_no: referenceNo || null,
        remarks,
        status: "PENDING",
        requested_by: userId,
        requested_at: nowManila(),
    };

    const header = await fetchDirectus<DirectusSingle<BatchHeaderRow>>(`${mustBase()}/items/${HEADERS}`, {
        method: "POST",
        headers: directusHeaders(),
        body: JSON.stringify(headerPayload),
    });

    const headerId = header.data ? normalizeHeaderId(header.data) : 0;
    if (!headerId) {
        throw new Error("Batch header was created without an id");
    }

    const detailPayload = linesToCreate.map((line) => ({
        header_id: headerId,
        product_id: line.product_id,
        price_type_id: line.price_type_id,
        current_price: line.current_price,
        proposed_price: line.proposed_price,
        status: "PENDING",
        requested_by: userId,
        requested_at: nowManila(),
    }));

    const details = await fetchDirectus<DirectusList<BatchDetailRow>>(`${mustBase()}/items/${DETAILS}`, {
        method: "POST",
        headers: directusHeaders(),
        body: JSON.stringify(detailPayload),
    });

    const created = details.data?.length ?? detailPayload.length;

    return {
        headerId,
        created,
        headerRow: header.data ?? { header_id: headerId },
    };
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
    const detailFields = [
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
    ].join(",");

    return fetchAllPagesLocal<BatchDetailRow>(DETAILS, () => {
        const params = new URLSearchParams();
        params.set("fields", detailFields);
        params.set("filter[header_id][_eq]", String(headerId));
        params.set("sort", "request_id");
        return params;
    });
}

export async function cancelPendingBatch(headerId: number, userId: number, reason: string) {
    const header = await getHeader(headerId);
    if (!header) return;

    const status = String(header.status ?? "");
    if (status !== "PENDING") return;

    await fetchDirectus(`${mustBase()}/items/${HEADERS}/${headerId}`, {
        method: "PATCH",
        headers: directusHeaders(),
        body: JSON.stringify({
            status: "CANCELLED",
            reject_reason: reason,
            rejected_by: userId,
            rejected_at: nowManila(),
        }),
    });

    const details = await getDetails(headerId);
    await Promise.all(
        details
            .map((line) => pickId(line.request_id))
            .filter((lineId): lineId is number => Boolean(lineId))
            .map((lineId) =>
                fetchDirectus(`${mustBase()}/items/${DETAILS}/${lineId}`, {
                    method: "PATCH",
                    headers: directusHeaders(),
                    body: JSON.stringify({ status: "CANCELLED" }),
                }),
            ),
    );
}

async function loadPriceTypeCatalog(): Promise<LegacyPriceTypeRow[]> {
    const rows = await fetchAllPagesLocal<PriceTypeRow>(PRICE_TYPES, () => {
        const params = new URLSearchParams();
        params.set("fields", "price_type_id,price_type_name,sort");
        params.set("sort", "sort,price_type_id");
        return params;
    });

    const catalog: LegacyPriceTypeRow[] = [];
    for (const row of rows) {
        const id = Number(row.price_type_id);
        const name = String(row.price_type_name ?? "").trim();
        if (Number.isFinite(id) && id > 0 && name) {
            catalog.push({
                price_type_id: id,
                price_type_name: name,
                sort: row.sort,
            });
        }
    }
    return catalog;
}

async function fetchExistingPrices(productIds: number[], priceTypeIds: number[]) {
    if (!productIds.length || !priceTypeIds.length) return new Map<string, number>();

    const map = new Map<string, number>();
    const productChunks = chunkArray(productIds, IN_CHUNK_SIZE);

    for (const productChunk of productChunks) {
        const rows = await fetchAllPagesLocal<ExistingPriceRow>(PRICES, () => {
            const params = new URLSearchParams();
            params.set("fields", "id,product_id,price_type_id");
            params.set("filter[product_id][_in]", productChunk.join(","));
            params.set("filter[price_type_id][_in]", priceTypeIds.join(","));
            return params;
        });

        for (const row of rows) {
            const productId = Number(row.product_id);
            const priceTypeId = Number(row.price_type_id);
            const id = Number(row.id);
            if (Number.isFinite(productId) && Number.isFinite(priceTypeId) && Number.isFinite(id) && id > 0) {
                map.set(`${productId}:${priceTypeId}`, id);
            }
        }
    }

    return map;
}

export async function rejectPriceChangeBatch(headerId: number, userId: number, rejectReason: string) {
    const header = await getHeader(headerId);
    if (!header) return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    if (String(header.status ?? "") !== "PENDING") {
        return NextResponse.json({ error: "Only PENDING batches can be rejected." }, { status: 400 });
    }

    await fetchDirectus(`${mustBase()}/items/${HEADERS}/${headerId}`, {
        method: "PATCH",
        headers: directusHeaders(),
        body: JSON.stringify({
            status: "REJECTED",
            rejected_by: userId,
            rejected_at: nowManila(),
            reject_reason: rejectReason,
        }),
    });

    const details = await getDetails(headerId);
    await Promise.all(
        details
            .map((line) => pickId(line.request_id))
            .filter((lineId): lineId is number => Boolean(lineId))
            .map((lineId) =>
                fetchDirectus(`${mustBase()}/items/${DETAILS}/${lineId}`, {
                    method: "PATCH",
                    headers: directusHeaders(),
                    body: JSON.stringify({ status: "REJECTED" }),
                }),
            ),
    );

    return NextResponse.json({ ok: true, header_id: headerId, rejected: details.length });
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
    const [existingPrices, priceTypeCatalog] = await Promise.all([
        fetchExistingPrices(productIds, priceTypeIds),
        loadPriceTypeCatalog(),
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

        const priceTypeName =
            priceTypeCatalog.find((row) => row.price_type_id === line.priceTypeId)?.price_type_name ?? "";
        const productPatch = resolveLegacyProductsPatch({
            priceTypeId: line.priceTypeId,
            priceTypeName,
            price: line.proposedPrice,
            catalog: priceTypeCatalog,
        });
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

    invalidateGroupIndexCacheOnCatalogChange();

    return NextResponse.json({ ok: true, header_id: headerId, affected: normalizedDetails.length });
}

type DirectusProductRow = {
    product_id?: number | string | null;
    parent_id?: number | string | null;
};

export async function getSupplierNamesByProductId(productIds: number[]): Promise<Map<number, string>> {
    const uniqueIds = Array.from(new Set(productIds.filter((id) => Number.isFinite(id) && id > 0)));
    if (uniqueIds.length === 0) return new Map();

    const parentMap = new Map<number, number>();
    for (let i = 0; i < uniqueIds.length; i += 200) {
        const chunk = uniqueIds.slice(i, i + 200);
        const p = new URLSearchParams();
        p.set("limit", "-1");
        p.set("fields", "product_id,parent_id");
        p.set("filter[product_id][_in]", chunk.join(","));
        const url = `${mustBase()}/items/${PRODUCTS}?${p.toString()}`;
        const json = await fetchDirectus<DirectusList<DirectusProductRow>>(url, { headers: directusHeaders() });
        for (const row of json.data ?? []) {
            const pid = pickId(row.product_id);
            const parentId = pickId(row.parent_id);
            if (pid && parentId) parentMap.set(pid, parentId);
        }
    }

    const allProductIds = Array.from(
        new Set([...uniqueIds, ...Array.from(parentMap.values())]),
    );

    const supplierLabels = new Map<number, Set<string>>();
    for (let i = 0; i < allProductIds.length; i += 200) {
        const chunk = allProductIds.slice(i, i + 200);
        const p = new URLSearchParams();
        p.set("limit", "-1");
        p.set("fields", "product_id,supplier_id,supplier_id.id,supplier_id.supplier_name,supplier_id.supplier_shortcut");
        p.set("filter[product_id][_in]", chunk.join(","));
        const url = `${mustBase()}/items/product_per_supplier?${p.toString()}`;
        const json = await fetchDirectus<DirectusList<Record<string, unknown>>>(url, { headers: directusHeaders() });

        for (const row of json.data ?? []) {
            const pid = pickId(row.product_id);
            if (!pid) continue;
            const supplier = row.supplier_id;
            if (!isRecord(supplier)) continue;
            const shortcut = String(supplier.supplier_shortcut ?? "").trim();
            const name = String(supplier.supplier_name ?? "").trim();
            const label = shortcut && name ? `${shortcut} - ${name}` : name || shortcut || `Supplier #${String(supplier.id ?? "")}`;
            const set = supplierLabels.get(pid) ?? new Set<string>();
            set.add(label);
            supplierLabels.set(pid, set);
        }
    }

    const collapse = (set: Set<string> | undefined): string | null => {
        if (!set || set.size === 0) return null;
        return Array.from(set).join(", ");
    };

    const resolve = (productId: number): string | null => {
        const direct = collapse(supplierLabels.get(productId));
        if (direct) return direct;
        const parentId = parentMap.get(productId);
        if (parentId) return collapse(supplierLabels.get(parentId));
        return null;
    };

    const result = new Map<number, string>();
    for (const id of uniqueIds) {
        const label = resolve(id);
        if (label) result.set(id, label);
    }
    return result;
}
