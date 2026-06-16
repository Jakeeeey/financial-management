import { NextRequest, NextResponse } from "next/server";

import {
    CostDetailRow,
    approveCostBatch,
    decodeUserIdFromJwtCookie,
    directusErrorResponse,
    getCostDetails,
    getCostHeader,
    getSupplierNamesByProductId,
    isRecord,
    normalizeCostHeaderId,
    normalizeCostProductId,
    pickId,
    rejectCostBatch,
    resolveBatchDecisionUserNames,
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

function mapDetail(line: CostDetailRow) {
    const current = line.current_cost === null || line.current_cost === undefined ? null : Number(line.current_cost);
    const proposed = Number(line.proposed_cost);
    const delta = Number.isFinite(proposed) && current !== null && Number.isFinite(current) ? proposed - current : null;
    const percentChange = delta !== null && current !== null && current !== 0 ? (delta / current) * 100 : null;

    return {
        request_id: pickId(line.request_id),
        product_id: normalizeCostProductId(line),
        product_name: productLabel(line.product_id),
        product_code: productCode(line.product_id),
        current_cost: Number.isFinite(current) ? current : null,
        proposed_cost: Number.isFinite(proposed) ? proposed : null,
        delta,
        percent_change: percentChange,
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
            return NextResponse.json({ error: "Invalid cost batch id" }, { status: 400 });
        }

        const header = await getCostHeader(headerId);
        if (!header) return NextResponse.json({ error: "Cost batch not found" }, { status: 404 });

        const details = await getCostDetails(headerId);

        const detailProductIds = details
            .map((line) => normalizeCostProductId(line))
            .filter((id) => id > 0);
        const supplierByProductId = await getSupplierNamesByProductId(detailProductIds);
        const { approved_by_name, rejected_by_name } = await resolveBatchDecisionUserNames(header);

        return NextResponse.json({
            data: {
                id: normalizeCostHeaderId(header),
                header_id: normalizeCostHeaderId(header),
                reference_no: header.reference_no ?? "",
                remarks: header.remarks ?? "",
                status: header.status ?? "PENDING",
                requested_by: header.requested_by ?? null,
                requested_at: header.requested_at ?? null,
                approved_by: header.approved_by ?? null,
                approved_at: header.approved_at ?? null,
                approved_by_name,
                rejected_by: header.rejected_by ?? null,
                rejected_at: header.rejected_at ?? null,
                rejected_by_name,
                reject_reason: header.reject_reason ?? null,
                details: details.map((line) => {
                    const pid = normalizeCostProductId(line);
                    return {
                        ...mapDetail(line),
                        supplier_name: supplierByProductId.get(pid) ?? null,
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
            return NextResponse.json({ error: "Invalid cost batch id" }, { status: 400 });
        }

        const body = (await req.json().catch(() => ({}))) as Partial<{
            action: string;
            reject_reason: string;
        }>;
        const action = String(body.action ?? "").trim().toLowerCase();

        if (action === "approve") {
            return approveCostBatch(headerId, userId);
        }

        if (action === "reject") {
            const rejectReason = String(body.reject_reason ?? "").trim();
            if (!rejectReason) {
                return NextResponse.json({ error: "reject_reason is required" }, { status: 400 });
            }
            return rejectCostBatch(headerId, userId, rejectReason);
        }

        return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
    } catch (error: unknown) {
        return directusErrorResponse(error);
    }
}
