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
    const salesmanId = searchParams.get("salesmanId");
    const customerNames = searchParams.get("customerNames");

    // 🚀 THE FIX: It now accepts EITHER salesmanId OR customerNames!
    if (!salesmanId && !customerNames) {
        return NextResponse.json({ message: "Missing salesmanId or customerNames" }, { status: 400 });
    }

    // 🚀 Pass along the exact query parameters we received!
    const targetUrl = `${getSpringBaseUrl()}/api/v1/collections/memos/available?${searchParams.toString()}`;

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
        const message = err instanceof Error ? err.message : 'An unknown error occurred';
        return NextResponse.json({ message }, { status: 500 });
    }
}