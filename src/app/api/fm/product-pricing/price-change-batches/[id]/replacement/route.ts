import { NextRequest, NextResponse } from "next/server";

import {
    BatchDetailRow,
    createPendingPriceBatch,
    decodeUserIdFromJwtCookie,
    directusErrorResponse,
    fetchLivePriceSnapshots,
    getDetails,
    getHeader,
    normalizeBatchCreateLines,
    normalizePriceTypeId,
    normalizeProductId,
    normalizeHeaderId,
    pickId,
} from "../../_batch";
import { isValidPriceValue } from "../../../_pricePrecision";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
    params: Promise<{ id: string }>;
};

function roundedPrice(value: unknown): number | null {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? Number(numberValue.toFixed(4)) : null;
}

function pricesMatch(left: unknown, right: unknown) {
    const leftPrice = roundedPrice(left);
    const rightPrice = roundedPrice(right);
    return leftPrice === rightPrice;
}

function replacementLine(line: BatchDetailRow) {
    const productId = normalizeProductId(line);
    const priceTypeId = normalizePriceTypeId(line);
    const proposedPrice = roundedPrice(line.proposed_price);

    if (!productId || !priceTypeId || proposedPrice === null || !isValidPriceValue(proposedPrice)) return null;

    return {
        request_id: pickId(line.request_id) ?? 0,
        product_id: productId,
        price_type_id: priceTypeId,
        proposed_price: proposedPrice,
    };
}

export async function POST(req: NextRequest, context: RouteContext) {
    try {
        const userId = decodeUserIdFromJwtCookie(req);
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { id } = await context.params;
        const sourceHeaderId = Number(id);
        if (!Number.isFinite(sourceHeaderId) || sourceHeaderId <= 0) {
            return NextResponse.json({ error: "Invalid source batch id" }, { status: 400 });
        }

        const sourceHeader = await getHeader(sourceHeaderId);
        if (!sourceHeader) return NextResponse.json({ error: "Source batch not found" }, { status: 404 });
        if (String(sourceHeader.status ?? "").toUpperCase() !== "FAILED") {
            return NextResponse.json({ error: "Only FAILED price batches can create replacements." }, { status: 400 });
        }

        const details = await getDetails(sourceHeaderId);
        const candidates = details
            .map(replacementLine)
            .filter((line): line is NonNullable<ReturnType<typeof replacementLine>> => line !== null);
        if (candidates.length === 0) {
            return NextResponse.json({ error: "Source batch has no valid proposed price lines." }, { status: 400 });
        }

        const livePrices = await fetchLivePriceSnapshots(candidates);
        const mismatchedLines = candidates.filter((line) =>
            !pricesMatch(livePrices.get(`${line.product_id}:${line.price_type_id}`) ?? null, line.proposed_price),
        );
        const plan = await normalizeBatchCreateLines(mismatchedLines);

        if (plan.linesToCreate.length === 0) {
            return NextResponse.json({
                source_header_id: normalizeHeaderId(sourceHeader),
                replacement_header_id: null,
                created: 0,
                effective_lines: candidates.length,
                mismatched_lines: mismatchedLines.length,
                skipped_existing_pending: plan.skippedExistingPending,
            });
        }

        const sourceReference = String(sourceHeader.reference_no ?? "").trim() || `PCB-${sourceHeaderId}`;
        const result = await createPendingPriceBatch({
            userId,
            supplierId: null,
            referenceNo: `${sourceReference}-REPLACEMENT`,
            remarks: `Replacement for PCB-${sourceHeaderId} after a price snapshot conflict. Latest live prices were used as new snapshots.`,
            linesToCreate: plan.linesToCreate,
        });

        return NextResponse.json({
            source_header_id: normalizeHeaderId(sourceHeader),
            replacement_header_id: result.headerId,
            created: result.created,
            effective_lines: candidates.length - mismatchedLines.length,
            mismatched_lines: mismatchedLines.length,
            skipped_existing_pending: plan.skippedExistingPending,
        }, { status: 201 });
    } catch (error: unknown) {
        return directusErrorResponse(error);
    }
}
