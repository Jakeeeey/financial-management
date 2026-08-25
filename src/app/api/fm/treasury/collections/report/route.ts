import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";

// Use the helper that matches your project's naming convention
const getSpringBaseUrl = () => {
    const url = process.env.SPRING_API_BASE_URL;
    return (url || "http://localhost:8080").replace(/\/$/, "");
};

export async function GET(req: NextRequest) {
    const cookieStore = await cookies();
    const token = cookieStore.get("vos_access_token")?.value;

    if (!token) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(req.url);
        const startDate = searchParams.get("startDate");
        const endDate = searchParams.get("endDate");

        if (!startDate || !endDate) {
            return NextResponse.json({ error: "Missing startDate or endDate" }, { status: 400 });
        }

        const targetUrl = `${getSpringBaseUrl()}/api/v1/collections/reports/summary?startDate=${startDate}&endDate=${endDate}`;

        // Forward the request to your Spring Boot Controller with the token
        const response = await fetch(targetUrl, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        });

        if (!response.ok) {
            // 🚀 FIXED: Read as text first to prevent "body stream already read" and TS1308 errors
            const errorText = await response.text();
            let errPayload;
            try {
                errPayload = JSON.parse(errorText); // Try to parse as JSON
            } catch {
                errPayload = { message: errorText }; // Fallback to plain text if it's an HTML error page
            }
            return NextResponse.json(errPayload, { status: response.status });
        }

        const data = await response.json();
        return NextResponse.json(data);

    } catch (error: unknown) {
        // Logs the error to your VS Code terminal so you can see it
        console.error("[BFF] GET /api/fm/treasury/collections/report failed:", error);

        return NextResponse.json({
            message: "BFF Error",
            detail: (error instanceof Error ? error.message : String(error))
        }, { status: 502 });
    }
}