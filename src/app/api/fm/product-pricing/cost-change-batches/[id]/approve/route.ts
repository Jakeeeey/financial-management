import { NextRequest, NextResponse } from "next/server";

import {
    approveCostBatch,
    decodeUserIdFromJwtCookie,
    directusErrorResponse,
    normalizeEffectiveAt,
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
            return NextResponse.json({ error: "Invalid cost batch id" }, { status: 400 });
        }

        const body = (await req.json().catch(() => ({}))) as Partial<{ effective_at: string | null }>;
        return approveCostBatch(headerId, userId, normalizeEffectiveAt(body.effective_at));
    } catch (error: unknown) {
        return directusErrorResponse(error);
    }
}
