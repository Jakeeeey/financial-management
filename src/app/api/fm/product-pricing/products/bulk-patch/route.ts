import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
    return NextResponse.json(
        {
            error: "Direct product cost updates are disabled. Submit a list cost change request for approval instead.",
            code: "price_control_request_required",
        },
        { status: 410 },
    );
}
