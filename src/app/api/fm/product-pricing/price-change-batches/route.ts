import { NextRequest, NextResponse } from "next/server";

import { parseApprovalSearchQuery } from "../_approvalSearch";
import { toInclusiveDateToEnd } from "../_dateFilters";
import { appendBatchSupplierFilter, resolveBatchSupplierFilter } from "../_supplierFilters";
import {
    BatchDetailRow,
    BatchHeaderRow,
    DETAILS,
    HEADERS,
    decodeUserIdFromJwtCookie,
    directusErrorResponse,
    directusHeaders,
    fetchDirectus,
    isRecord,
    mustBase,
    normalizeHeaderId,
    normalizePriceTypeId,
    normalizeProductId,
    nowManila,
    pickId,
} from "./_batch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DirectusList<T> = { data?: T[]; meta?: { total_count?: number } | null };
type DirectusSingle<T> = { data?: T };

type CreateLine = {
    product_id: number;
    price_type_id: number;
    current_price?: number | null;
    proposed_price: number;
};

function norm(value: string | null) {
    const text = String(value ?? "").trim();
    if (!text || text === "undefined" || text === "null") return "";
    return text;
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

function toKey(productId: number, priceTypeId: number) {
    return `${productId}:${priceTypeId}`;
}

async function countLines(headerId: number) {
    const params = new URLSearchParams();
    params.set("limit", "1");
    params.set("meta", "total_count");
    params.set("fields", "request_id");
    params.set("filter[header_id][_eq]", String(headerId));

    const url = `${mustBase()}/items/${DETAILS}?${params.toString()}`;
    const json = await fetchDirectus<DirectusList<BatchDetailRow>>(url, { headers: directusHeaders() });
    return Number(json.meta?.total_count ?? 0);
}

async function getExistingPendingKeys(lines: Required<CreateLine>[]) {
    const productIds = Array.from(new Set(lines.map((line) => line.product_id)));
    const priceTypeIds = Array.from(new Set(lines.map((line) => line.price_type_id)));

    if (!productIds.length || !priceTypeIds.length) return new Set<string>();

    const params = new URLSearchParams();
    params.set("limit", "-1");
    params.set("fields", "request_id,product_id,price_type_id");
    params.set("filter[_and][0][status][_eq]", "PENDING");
    params.set("filter[_and][1][product_id][_in]", productIds.join(","));
    params.set("filter[_and][2][price_type_id][_in]", priceTypeIds.join(","));

    const url = `${mustBase()}/items/${DETAILS}?${params.toString()}`;
    const json = await fetchDirectus<DirectusList<BatchDetailRow>>(url, { headers: directusHeaders() });

    const keys = new Set<string>();
    for (const row of json.data ?? []) {
        const productId = normalizeProductId(row);
        const priceTypeId = normalizePriceTypeId(row);
        if (productId > 0 && priceTypeId > 0) {
            keys.add(toKey(productId, priceTypeId));
        }
    }

    return keys;
}

function mapHeader(row: BatchHeaderRow, lineCount = 0) {
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

export async function GET(req: NextRequest) {
    try {
        mustBase();
        const userId = decodeUserIdFromJwtCookie(req);
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const status = norm(searchParams.get("status"));
        const supplierId = norm(searchParams.get("supplier_id"));
        const q = norm(searchParams.get("q"));
        const dateFrom = norm(searchParams.get("date_from"));
        const dateTo = norm(searchParams.get("date_to"));
        const page = Math.max(1, Number(searchParams.get("page") ?? 1));
        const pageSize = Math.min(100, Math.max(10, Number(searchParams.get("page_size") ?? 50)));
        const offset = (page - 1) * pageSize;

        const params = new URLSearchParams();
        params.set("limit", String(pageSize));
        params.set("offset", String(offset));
        params.set("meta", "total_count");
        params.set("sort", "-requested_at");
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

        let andIdx = 0;
        const addAnd = (suffix: string, value: string) => {
            params.set(`filter[_and][${andIdx}]${suffix}`, value);
            andIdx += 1;
        };

        if (status) addAnd("[status][_eq]", status);
        if (supplierId) {
            const { headerIdsFromProducts } = await resolveBatchSupplierFilter(supplierId);
            andIdx = appendBatchSupplierFilter(params, andIdx, supplierId, headerIdsFromProducts);
        }
        if (dateFrom) addAnd("[requested_at][_gte]", dateFrom);
        if (dateTo) addAnd("[requested_at][_lte]", toInclusiveDateToEnd(dateTo));
        if (q) {
            const parsed = parseApprovalSearchQuery(q);
            const headerId = parsed.batchHeaderId ?? parsed.numericId;

            if (headerId != null) {
                addAnd("[header_id][_eq]", String(headerId));
            } else if (parsed.textContains) {
                addAnd("[_or][0][reference_no][_contains]", parsed.textContains);
                params.set(`filter[_and][${andIdx - 1}][_or][1][remarks][_contains]`, parsed.textContains);
            }
        }

        const url = `${mustBase()}/items/${HEADERS}?${params.toString()}`;
        const json = await fetchDirectus<DirectusList<BatchHeaderRow>>(url, { headers: directusHeaders() });

        const rows = await Promise.all(
            (json.data ?? []).map(async (row) => {
                const headerId = normalizeHeaderId(row);
                return mapHeader(row, headerId ? await countLines(headerId) : 0);
            }),
        );

        return NextResponse.json({ data: rows, meta: json.meta ?? null });
    } catch (error: unknown) {
        return directusErrorResponse(error);
    }
}

export async function POST(req: NextRequest) {
    try {
        mustBase();
        const userId = decodeUserIdFromJwtCookie(req);
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const body = (await req.json()) as Partial<{
            supplier_id: number;
            reference_no: string;
            remarks: string;
            lines: CreateLine[];
        }>;

        const supplierId = Number(body.supplier_id);
        const lines = Array.isArray(body.lines) ? body.lines : [];
        const remarks = String(body.remarks ?? "").trim();
        const referenceNo = String(body.reference_no ?? "").trim();

        if (!Number.isFinite(supplierId) || supplierId <= 0) {
            return NextResponse.json({ error: "supplier_id is required" }, { status: 400 });
        }
        if (!remarks) {
            return NextResponse.json({ error: "remarks is required" }, { status: 400 });
        }
        if (lines.length === 0) {
            return NextResponse.json({ error: "lines must be a non-empty array" }, { status: 400 });
        }

        const seen = new Set<string>();
        const normalizedLines: Required<CreateLine>[] = [];
        let skippedDuplicates = 0;

        for (const line of lines) {
            const productId = Number(line.product_id);
            const priceTypeId = Number(line.price_type_id);
            const currentPrice = line.current_price === null || line.current_price === undefined ? null : Number(line.current_price);
            const proposedPrice = Number(line.proposed_price);

            if (!Number.isFinite(productId) || productId <= 0) continue;
            if (!Number.isFinite(priceTypeId) || priceTypeId <= 0) continue;
            if (!Number.isFinite(proposedPrice) || proposedPrice < 0) continue;

            const key = toKey(productId, priceTypeId);
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

        if (normalizedLines.length === 0) {
            return NextResponse.json({ error: "No valid detail lines to create" }, { status: 400 });
        }

        const existingPendingKeys = await getExistingPendingKeys(normalizedLines);
        const linesToCreate = normalizedLines.filter(
            (line) => !existingPendingKeys.has(toKey(line.product_id, line.price_type_id)),
        );
        const skippedExistingPending = normalizedLines.length - linesToCreate.length;

        if (linesToCreate.length === 0) {
            return NextResponse.json(
                {
                    created: 0,
                    skipped_duplicates: skippedDuplicates,
                    skipped_existing_pending: skippedExistingPending,
                },
                { status: 200 },
            );
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
            return NextResponse.json({ error: "Batch header was created without an id" }, { status: 500 });
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

        return NextResponse.json(
            {
                data: mapHeader(header.data ?? { header_id: headerId }, detailPayload.length),
                created: details.data?.length ?? detailPayload.length,
                skipped_duplicates: skippedDuplicates,
                skipped_existing_pending: skippedExistingPending,
            },
            { status: 201 },
        );
    } catch (error: unknown) {
        return directusErrorResponse(error);
    }
}
