import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";

const getSpringBaseUrl = () => {
    const url = process.env.SPRING_API_BASE_URL;
    return (url || "http://localhost:8080").replace(/\/$/, "");
};

export async function POST(
    _request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    const cookieStore = await cookies();
    const token = cookieStore.get("vos_access_token")?.value;

    if (!token) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const targetUrl = `${getSpringBaseUrl()}/api/v1/collections/${id}/allocate/clear`;

    try {
        const springRes = await fetch(targetUrl, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({}),
            cache: "no-store",
        });

        const responseText = await springRes.text();
        let responseBody: unknown = {};

        try {
            responseBody = responseText ? JSON.parse(responseText) : {};
        } catch {
            responseBody = { message: responseText };
        }

        return NextResponse.json(responseBody, { status: springRes.status });
    } catch (error: unknown) {
        return NextResponse.json({
            message: "Failed to clear settlement allocations.",
            detail: error instanceof Error ? error.message : String(error),
        }, { status: 502 });
    }
}
