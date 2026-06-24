import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";

const getSpringBaseUrl = () => {
    const url = process.env.SPRING_API_BASE_URL;
    return (url || "http://localhost:8080").replace(/\/$/, "");
};

// 🚀 FIXED: Added `req: NextRequest` to access the URL parameters
export async function GET(req: NextRequest) {
    const cookieStore = await cookies();
    const token = cookieStore.get("vos_access_token")?.value;

    if (!token) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Extract the pagination params sent by the React frontend
    const searchParams = req.nextUrl.searchParams;
    const page = searchParams.get("page") || "0";
    const size = searchParams.get("size") || "50";
    const search = searchParams.get("search") || ""; // 🚀 NEW

    // 🚀 FIXED: Changed /api/fm/ to /api/v1/ to perfectly match your Spring Boot Controller
    const targetUrl = `${getSpringBaseUrl()}/api/v1/treasury/bank-deposits/vault?page=${page}&size=${size}&search=${encodeURIComponent(search)}`;
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
        console.error("[BFF GET Vault Assets Exception]:", err);
        return NextResponse.json({
            message: "BFF Error",
            detail: (err instanceof Error ? err.message : String(err))
        }, { status: 502 });
    }
}