import {  NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";

const getSpringBaseUrl = () => {
    const url = process.env.SPRING_API_BASE_URL;
    return (url || "http://localhost:8080").replace(/\/$/, "");
};

export async function GET() {
    const cookieStore = await cookies();
    const token = cookieStore.get("vos_access_token")?.value;

    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    // 🚀 Points to the master list of bills/coins in your Java Controller
    const targetUrl = `${getSpringBaseUrl()}/api/v1/denominations`;

    try {
        const springRes = await fetch(targetUrl, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            // Since denominations rarely change, you could also use { revalidate: 3600 }
            // but no-store is safer for a fresh dev environment.
            cache: "no-store",
        });

        if (!springRes.ok) {
            const errorText = await springRes.text();
            throw new Error(errorText);
        }

        const data = await springRes.json();
        return NextResponse.json(data);

    } catch (err: unknown) {
        console.error("[BFF] GET /api/fm/treasury/denominations failed:", err);
        return NextResponse.json({
            message: "BFF Error",
            detail: (err instanceof Error ? err.message : String(err))
        }, { status: 502 });
    }
}