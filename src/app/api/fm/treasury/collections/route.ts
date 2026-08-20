import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";

const getSpringBaseUrl = () => {
    const url = process.env.SPRING_API_BASE_URL;
    return (url || "http://localhost:8080").replace(/\/$/, "");
};

const getSpringErrorMessage = (errorText: string, fallback: string) => {
    try {
        const parsed = JSON.parse(errorText) as { detail?: string; message?: string; error?: string };
        return parsed.detail || parsed.message || parsed.error || fallback;
    } catch {
        return errorText || fallback;
    }
};

export async function GET() {
    const cookieStore = await cookies();
    const token = cookieStore.get("vos_access_token")?.value;

    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    return NextResponse.json({
        error: "UNPOSTED_COLLECTIONS_DEPRECATED",
        message: "Use /api/fm/treasury/collections/unposted instead.",
        replacement: "/api/fm/treasury/collections/unposted",
    }, { status: 410 });
}

export async function POST(request: NextRequest) {
    const cookieStore = await cookies();
    const token = cookieStore.get("vos_access_token")?.value;

    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const targetUrl = `${getSpringBaseUrl()}/api/v1/collections/receive`;

    try {
        const springRes = await fetch(targetUrl, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body),
        });

        // 🚀 FIXED: Added robust error logging to catch the "Silent 502"
        if (!springRes.ok) {
            const errorText = await springRes.text();
            console.error(`[Spring Boot POST Error] Status: ${springRes.status}, Body:`, errorText);
            return NextResponse.json({
                message: getSpringErrorMessage(errorText, `Spring Boot rejected with status: ${springRes.status}`)
            }, { status: springRes.status });
        }

        // Backend returns raw string DocNo (e.g., "CP-000001")
        const result = await springRes.text();
        return new NextResponse(result, {
            status: 200,
            headers: { 'Content-Type': 'text/plain' }
        });
    } catch (err: unknown) {
        console.error("[BFF POST Exception]:", err);
        return NextResponse.json({
            message: "BFF Error",
            detail: (err instanceof Error ? err.message : String(err))
        }, { status: 502 });
    }
}
