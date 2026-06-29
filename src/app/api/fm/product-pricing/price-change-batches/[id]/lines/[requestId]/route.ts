import { NextRequest, NextResponse } from "next/server";

import {
    decodeUserIdFromJwtCookie,
    directusErrorResponse,
    removePriceChangeBatchLine,
} from "../../../_batch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
    params: Promise<{ id: string; requestId: string }>;
};

export async function DELETE(req: NextRequest, context: RouteContext) {
    try {
        const userId = decodeUserIdFromJwtCookie(req);
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { id, requestId } = await context.params;
        const headerId = Number(id);
        const lineId = Number(requestId);
        if (!Number.isFinite(headerId) || headerId <= 0) {
            return NextResponse.json({ error: "Invalid batch id" }, { status: 400 });
        }
        if (!Number.isFinite(lineId) || lineId <= 0) {
            return NextResponse.json({ error: "Invalid batch line id" }, { status: 400 });
        }

        return removePriceChangeBatchLine(headerId, lineId);
    } catch (error: unknown) {
        return directusErrorResponse(error);
    }
}
