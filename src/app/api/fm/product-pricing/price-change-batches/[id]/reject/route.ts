import { NextRequest, NextResponse } from "next/server";
import {
    DETAILS,
    HEADERS,
    decodeUserIdFromJwtCookie,
    directusErrorResponse,
    directusHeaders,
    fetchDirectus,
    getDetails,
    getHeader,
    mustBase,
    nowManila,
    pickId,
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
    } catch (error: unknown) {
        return directusErrorResponse(error);
    }
}
