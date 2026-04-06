import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";

const getSpringBaseUrl = () => {
    const url = process.env.SPRING_API_BASE_URL;
    return (url || "http://localhost:8080").replace(/\/$/, "");
};

// 🚀 FIX: Typed params as a Promise for Next.js 15!
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const cookieStore = await cookies();
    const token = cookieStore.get("vos_access_token")?.value;

    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    // 🚀 FIX: Await the params before extracting the ID!
    const resolvedParams = await params;
    const id = resolvedParams.id;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    if (!status) return NextResponse.json({ message: "Status is required" }, { status: 400 });

    const targetUrl = `${getSpringBaseUrl()}/api/disbursements/${id}/status?status=${encodeURIComponent(status)}`;

    try {
        const springRes = await fetch(targetUrl, {
            method: "PATCH",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        });

        if (!springRes.ok) throw new Error(await springRes.text());
        return NextResponse.json(await springRes.json());
    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ message: "BFF Error", detail: errorMessage }, { status: 502 });
    }
}