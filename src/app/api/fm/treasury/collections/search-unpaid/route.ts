import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";

const getSpringBaseUrl = () => {
    const url = process.env.SPRING_API_BASE_URL;
    return (url || "http://localhost:8080").replace(/\/$/, "");
};

export async function GET(request: NextRequest) {
    // 1. Auth Check
    const cookieStore = await cookies();
    const token = cookieStore.get("vos_access_token")?.value;

    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    // 2. Extract Query Parameters
    const { searchParams } = new URL(request.url);
    const salesmanId = searchParams.get("salesmanId");
    const query = searchParams.get("query");

    if (!salesmanId || !query) {
        return NextResponse.json({ message: "Missing salesmanId or search query" }, { status: 400 });
    }

    // 3. Construct Spring Boot Target URL
    // ⚠️ Adjust this path if you put the search endpoint in SalesInvoiceController instead of CollectionController
    const targetUrl = `${getSpringBaseUrl()}/api/v1/collections/search-unpaid?salesmanId=${salesmanId}&query=${encodeURIComponent(query)}`;

    try {
        const springRes = await fetch(targetUrl, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            cache: "no-store", // Crucial for live search!
        });

        if (!springRes.ok) {
            const errorText = await springRes.text();
            console.error(`[Spring Boot GET Error] Status: ${springRes.status}, Body:`, errorText);
            throw new Error(errorText || `Spring GET Error: ${springRes.status}`);
        }

        const data = await springRes.json();

        // Optional: If you need to map the DTO on the frontend, do it here.
        // Otherwise, just return the raw JSON from Spring Boot.
        return NextResponse.json(data);

    } catch (err: unknown) {
        console.error("[BFF GET Exception]:", err);
        return NextResponse.json({
            message: "BFF Search Error",
            detail: (err instanceof Error ? err.message : String(err))
        }, { status: 502 });
    }
}