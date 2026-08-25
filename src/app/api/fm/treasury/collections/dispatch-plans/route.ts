import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";

const getSpringBaseUrl = () => {
    const url = process.env.SPRING_API_BASE_URL;
    return (url || "http://localhost:8080").replace(/\/$/, "");
};

export async function GET(request: NextRequest) {
    const cookieStore = await cookies();
    const token = cookieStore.get("vos_access_token")?.value; // Or whatever your auth cookie is named

    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    // 🚀 Automatically grabs the ?salesmanId=X&date=Y query parameters
    const queryString = request.nextUrl.search;

    // ⚠️ Ensure this matches the @GetMapping path in your Spring Boot CollectionController
    const targetUrl = `${getSpringBaseUrl()}/api/v1/collections/dispatch-plans${queryString}`;

    try {
        const springRes = await fetch(targetUrl, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            cache: "no-store",
        });

        if (!springRes.ok) {
            const errorText = await springRes.text();
            throw new Error(errorText || `Spring GET Error: ${springRes.status}`);
        }

        const data = await springRes.json();
        return NextResponse.json(data);
    } catch (err: unknown) {
        console.error("[BFF GET Dispatch Plans Exception]:", err);
        return NextResponse.json({
            message: "BFF Error fetching Dispatch Plans",
            detail: (err instanceof Error ? err.message : String(err))
        }, { status: 502 });
    }
}