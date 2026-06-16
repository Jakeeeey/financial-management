import { NextRequest, NextResponse } from "next/server";
import {
    decodeUserIdFromJwtCookie,
    directusErrorResponse,
    rejectPriceChangeBatch,
} from "../../_batch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
    params: Promise<{ id: string }>;
};

export async function POST(req: NextRequest, context: RouteContext) {
    try {
        const userId = decodeUserIdFromJwtCookie(req);
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { id } = await context.params;
        const headerId = Number(id);
        if (!Number.isFinite(headerId) || headerId <= 0) {
            return NextResponse.json({ error: "Invalid batch id" }, { status: 400 });
        }

        const body = (await req.json().catch(() => ({}))) as Partial<{ reject_reason: string }>;
        const rejectReason = String(body.reject_reason ?? "").trim();
        if (!rejectReason) {
            return NextResponse.json({ error: "reject_reason is required" }, { status: 400 });
        }

        return rejectPriceChangeBatch(headerId, userId, rejectReason);
    } catch (error: unknown) {
        return directusErrorResponse(error);
    }
}
