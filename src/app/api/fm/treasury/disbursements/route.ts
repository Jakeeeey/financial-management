import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";

const getSpringBaseUrl = () => {
    const url = process.env.SPRING_API_BASE_URL;
    return (url || "http://localhost:8080").replace(/\/$/, "");
};

export async function GET(request: NextRequest) {
    const cookieStore = await cookies();
    const token = cookieStore.get("vos_access_token")?.value;

    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const page = searchParams.get("page") || "0";
    const size = searchParams.get("size") || "20";
    const type = searchParams.get("type") || "";

    // 🚀 NEW: Catch the supplier and date filters
    const supplier = searchParams.get("supplier") || "";
    const startDate = searchParams.get("startDate") || "";
    const endDate = searchParams.get("endDate") || "";

    let targetUrl = `${getSpringBaseUrl()}/api/disbursements?page=${page}&size=${size}`;

    if (type && type !== "All") targetUrl += `&type=${encodeURIComponent(type)}`;
    if (supplier) targetUrl += `&supplier=${encodeURIComponent(supplier)}`;
    if (startDate) targetUrl += `&startDate=${encodeURIComponent(startDate)}`;
    if (endDate) targetUrl += `&endDate=${encodeURIComponent(endDate)}`;

    try {
        const springRes = await fetch(targetUrl, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            cache: "no-store",
        });

        if (!springRes.ok) throw new Error(await springRes.text());
        return NextResponse.json(await springRes.json());
    } catch (err: unknown) {
        return NextResponse.json({ message: "BFF Error", detail: (err instanceof Error ? err.message : String(err)) }, { status: 502 });
    }
}

export async function POST(request: NextRequest) {
    const cookieStore = await cookies();
    const token = cookieStore.get("vos_access_token")?.value;

    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const targetUrl = `${getSpringBaseUrl()}/api/disbursements`;

    try {
        const springRes = await fetch(targetUrl, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body),
        });

        if (!springRes.ok) throw new Error(await springRes.text());
        return NextResponse.json(await springRes.json());
    } catch (err: unknown) {
        return NextResponse.json({ message: "BFF Error", detail: (err instanceof Error ? err.message : String(err)) }, { status: 502 });
    }
}
