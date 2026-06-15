import { NextResponse, NextRequest } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";

const getSpringBaseUrl = () => {
    const url = process.env.SPRING_API_BASE_URL;
    return (url || "http://localhost:8080").replace(/\/$/, "");
};

export async function GET(request: NextRequest) {
    const cookieStore = await cookies();
    const token = cookieStore.get("vos_access_token")?.value;

    if (!token) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // 🚀 Pass the entire URL search query directly to Spring Boot
    const { searchParams } = new URL(request.url);
    const queryString = searchParams.toString();
    const targetUrl = `${getSpringBaseUrl()}/api/v1/collections/settlement-queue?${queryString}`;

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

        const data = await springRes.json();
        return NextResponse.json(data);
    } catch (err: unknown) {
        return NextResponse.json({ message: "BFF Error", detail: String(err) }, { status: 502 });
    }
}