import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";

const getSpringBaseUrl = () => {
    const url = process.env.SPRING_API_BASE_URL;
    return (url || "http://localhost:8080").replace(/\/$/, "");
};

// 🚀 Typed params as a Promise for Next.js 15!
export async function GET(request: NextRequest, { params }: { params: Promise<{ supplierId: string }> }) {
    const cookieStore = await cookies();
    const token = cookieStore.get("vos_access_token")?.value;

    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    // 🚀 Await the params before extracting the ID!
    const resolvedParams = await params;
    const targetUrl = `${getSpringBaseUrl()}/api/disbursements/memos/${resolvedParams.supplierId}`;

    try {
        const springRes = await fetch(targetUrl, {
            headers: { "Authorization": `Bearer ${token}` },
            cache: "no-store",
        });

        if (!springRes.ok) throw new Error(await springRes.text());
        return NextResponse.json(await springRes.json());
    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
        return NextResponse.json({ message: "BFF Error", detail: errorMessage }, { status: 502 });
    }
}