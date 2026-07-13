import { NextRequest, NextResponse } from "next/server";

import { MatrixSetupError, initializeMissingMatrixRow } from "../_matrixSetup";
import { isInvalidPriceValueError } from "../_pricePrecision";
import {
    decodeUserIdFromJwtCookie,
    directusErrorResponse,
} from "../price-change-batches/_batch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    try {
        const userId = decodeUserIdFromJwtCookie(req);
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const body = (await req.json()) as Partial<{
            product_id: number;
            price_type_id: number;
            initial_price: number;
        }>;
        const productId = Number(body.product_id);
        const priceTypeId = Number(body.price_type_id);

        if (!Number.isFinite(productId) || productId <= 0) {
            return NextResponse.json({ error: "product_id is required" }, { status: 400 });
        }
        if (!Number.isFinite(priceTypeId) || priceTypeId <= 0) {
            return NextResponse.json({ error: "price_type_id is required" }, { status: 400 });
        }

        const result = await initializeMissingMatrixRow({
            userId,
            productId,
            priceTypeId,
            initialPrice: body.initial_price,
        });

        return NextResponse.json({ data: result.row, id: result.id }, { status: 201 });
    } catch (error: unknown) {
        if (error instanceof MatrixSetupError) {
            return NextResponse.json(
                { error: error.message, code: error.code, ...error.data },
                { status: error.status },
            );
        }
        if (isInvalidPriceValueError(error)) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        return directusErrorResponse(error);
    }
}
