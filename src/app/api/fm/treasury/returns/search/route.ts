import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
    const cookieStore = await cookies();
    const token = cookieStore.get("vos_access_token")?.value;
    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const documentNo = searchParams.get("documentNo");
    if (!documentNo) return NextResponse.json({ message: "Missing documentNo" }, { status: 400 });

    const baseUrl = (process.env.SPRING_API_BASE_URL || "http://localhost:8080").replace(/\/$/, "");
    const targetUrl = `${baseUrl}/api/v1/collections/returns/search?documentNo=${encodeURIComponent(documentNo)}`;

    try {
        const springRes = await fetch(targetUrl, {
            headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" }, cache: "no-store"
        });
        if (!springRes.ok) return NextResponse.json({ message: "Not found" }, { status: springRes.status });
        return NextResponse.json(await springRes.json());
    } catch (err) {
        console.error("Error fetching treasury returns:", err);
        return NextResponse.json({ message: "Server error" }, { status: 500 });
    }
}