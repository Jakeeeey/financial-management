import { NextRequest, NextResponse } from "next/server";
import {
    BatchDetailRow,
    applyApprovedBatch,
    decodeUserIdFromJwtCookie,
    directusErrorResponse,
    fetchUserNamesById,
    getDetails,
    getHeader,
    getSupplierNamesByProductId,
    isRecord,
    normalizeHeaderId,
    normalizePriceTypeId,
    normalizeProductId,
    pickId,
    rejectPriceChangeBatch,
    resolveBatchDecisionUserNames,
    resolveUserDisplayName,
} from "../_batch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
    params: Promise<{ id: string }>;
};

function productLabel(value: unknown) {
    if (!isRecord(value)) return "";
    return String(value.product_name ?? value.product_code ?? "").trim();
}

function productCode(value: unknown) {
    return isRecord(value) ? String(value.product_code ?? "").trim() : "";
}

function priceTypeName(value: unknown) {
    return isRecord(value) ? String(value.price_type_name ?? "").trim() : "";
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

function userIdOf(value: unknown): number | string | null {
    if (isRecord(value)) {
        return pickId(value.user_id) ?? pickId(value.id);
    }
    return pickId(value);
}

function userNameOf(value: unknown): string | null {
    if (!isRecord(value)) return null;

    const fullName = [value.user_fname, value.user_mname, value.user_lname]
        .map((part) => String(part ?? "").trim())
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();

    if (fullName) return fullName;

    const email = String(value.user_email ?? "").trim();
    return email || null;
}

function productUomLabel(value: unknown): string {
    if (!isRecord(value)) return "";
    const uom = value.unit_of_measurement;
    if (!isRecord(uom)) return "";
    return String(uom.unit_shortcut ?? uom.unit_name ?? "").trim();
}

function mapDetail(line: BatchDetailRow) {
    const current = line.current_price === null || line.current_price === undefined ? null : Number(line.current_price);
    const proposed = Number(line.proposed_price);
    const delta = Number.isFinite(proposed) && current !== null && Number.isFinite(current) ? proposed - current : null;
    const percentChange = delta !== null && current !== null && current !== 0 ? (delta / current) * 100 : null;

    return {
        request_id: pickId(line.request_id),
        product_id: normalizeProductId(line),
        product_name: productLabel(line.product_id),
        product_code: productCode(line.product_id),
        price_type_id: normalizePriceTypeId(line),
        price_type_name: priceTypeName(line.price_type_id),
        current_price: Number.isFinite(current) ? current : null,
        proposed_price: Number.isFinite(proposed) ? proposed : null,
        delta,
        percent_change: percentChange,
        unit_name: productUomLabel(line.product_id),
        status: line.status ?? "PENDING",
    };
}

export async function GET(req: NextRequest, context: RouteContext) {
    try {
        const userId = decodeUserIdFromJwtCookie(req);
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { id } = await context.params;
        const headerId = Number(id);
        if (!Number.isFinite(headerId) || headerId <= 0) {
            return NextResponse.json({ error: "Invalid batch id" }, { status: 400 });
        }

        const header = await getHeader(headerId);
        if (!header) return NextResponse.json({ error: "Batch not found" }, { status: 404 });

        const details = await getDetails(headerId);

        const detailProductIds = details
            .map((line) => normalizeProductId(line))
            .filter((id) => id > 0);
        const supplierByProductId = await getSupplierNamesByProductId(detailProductIds);
        const { approved_by_name, rejected_by_name } = await resolveBatchDecisionUserNames(header);
        const detailRequester = details.find((line) => userIdOf(line.requested_by) !== null)?.requested_by ?? null;
        const requestedBy = header.requested_by ?? detailRequester;
        const requestedById = userIdOf(requestedBy);
        const requesterNamesById = await fetchUserNamesById([requestedById]);
        const requested_by_name = userNameOf(requestedBy) ?? resolveUserDisplayName(requestedById, requesterNamesById);

        return NextResponse.json({
            data: {
                id: normalizeHeaderId(header),
                header_id: normalizeHeaderId(header),
                supplier_id: supplierIdOf(header.supplier_id),
                supplier_name: supplierNameOf(header.supplier_id),
                reference_no: header.reference_no ?? "",
                remarks: header.remarks ?? "",
                status: header.status ?? "PENDING",
                requested_by: requestedById,
                requested_by_name,
                requested_at: header.requested_at ?? null,
                approved_by: header.approved_by ?? null,
                approved_at: header.approved_at ?? null,
                approved_by_name,
                rejected_by: header.rejected_by ?? null,
                rejected_at: header.rejected_at ?? null,
                rejected_by_name,
                reject_reason: header.reject_reason ?? null,
                effective_at: header.effective_at ?? null,
                application_status: header.application_status ?? null,
                applied_at: header.applied_at ?? null,
                applied_by: header.applied_by ?? null,
                details: details.map((line) => {
                    const pid = normalizeProductId(line);
                    return {
                        ...mapDetail(line),
                        supplier_name: supplierByProductId.get(pid) ?? null,
                        effective_at: line.effective_at ?? null,
                        application_status: line.application_status ?? null,
                        applied_at: line.applied_at ?? null,
                        applied_by: line.applied_by ?? null,
                    };
                }),
            },
        });
    } catch (error: unknown) {
        return directusErrorResponse(error);
    }
}

export async function POST(req: NextRequest, context: RouteContext) {
    try {
        const userId = decodeUserIdFromJwtCookie(req);
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { id } = await context.params;
        const headerId = Number(id);
        if (!Number.isFinite(headerId) || headerId <= 0) {
            return NextResponse.json({ error: "Invalid batch id" }, { status: 400 });
        }

        const body = (await req.json().catch(() => ({}))) as Partial<{
            action: string;
            reject_reason: string;
            effective_at: string | null;
        }>;
        const action = String(body.action ?? "").trim().toLowerCase();

        if (action === "approve") {
            return applyApprovedBatch(headerId, userId, body.effective_at);
        }

        if (action === "reject") {
            const rejectReason = String(body.reject_reason ?? "").trim();
            if (!rejectReason) {
                return NextResponse.json({ error: "reject_reason is required" }, { status: 400 });
            }
            return rejectPriceChangeBatch(headerId, userId, rejectReason);
        }

        return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
    } catch (error: unknown) {
        return directusErrorResponse(error);
    }
}
