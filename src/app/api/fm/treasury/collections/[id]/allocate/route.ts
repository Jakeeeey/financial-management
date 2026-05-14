import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";

const getSpringBaseUrl = () => {
    const url = process.env.SPRING_API_BASE_URL;
    return (url || "http://localhost:8080").replace(/\/$/, "");
};

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const cookieStore = await cookies();
    const token = cookieStore.get("vos_access_token")?.value;

    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const collectionId = params.id;
    const body = await request.json();
    const targetUrl = `${getSpringBaseUrl()}/api/v1/collections/${collectionId}/allocate`;

    try {
        const springRes = await fetch(targetUrl, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body),
        });

        if (!springRes.ok) {
            const errorText = await springRes.text();
            console.error(`[Spring Boot POST Allocate Error] Status: ${springRes.status}`, errorText);
            throw new Error(errorText || `Spring Boot rejected with status: ${springRes.status}`);
        }

        const result = await springRes.text();
        return new NextResponse(result, {
            status: 200,
            headers: { 'Content-Type': 'text/plain' }
        });
    } catch (err: unknown) {
        console.error("[BFF POST Allocate Exception]:", err);
        return NextResponse.json({
            message: "BFF Error",
            detail: (err instanceof Error ? err.message : String(err))
        }, { status: 502 });
    }
}