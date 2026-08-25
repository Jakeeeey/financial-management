import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(request: NextRequest, context: { params: Promise<{ detailId: string }> }) {
    const { detailId } = await context.params;
    const body = await request.json();
    const cookieStore = await cookies();
    const token = cookieStore.get("vos_access_token")?.value;

    if (!token) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    try {
        const springRes = await fetch(`${process.env.SPRING_API_BASE_URL}/api/v1/treasury/bank-deposits/details/${detailId}/bounce`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });

        const responseText = await springRes.text();
        let responsePayload: Record<string, unknown> = {};
        if (responseText.trim()) {
            try {
                const parsed = JSON.parse(responseText) as unknown;
                responsePayload = parsed && typeof parsed === "object" && !Array.isArray(parsed)
                    ? parsed as Record<string, unknown>
                    : { message: responseText };
            } catch {
                responsePayload = { message: responseText };
            }
        }

        if (!springRes.ok) {
            return NextResponse.json(responsePayload, { status: springRes.status });
        }
        return NextResponse.json({ success: true, ...responsePayload }, { status: springRes.status });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'An unknown error occurred';
        return NextResponse.json({ message }, { status: 502 });
    }
}