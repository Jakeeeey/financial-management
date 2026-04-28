import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";

const getSpringBaseUrl = () => {
    const url = process.env.SPRING_API_BASE_URL;
    return (url || "http://localhost:8080").replace(/\/$/, "");
};

// 🚀 PUT: Update an Adjustment
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const cookieStore = await cookies();
    const token = cookieStore.get("vos_access_token")?.value;

    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const targetUrl = `${getSpringBaseUrl()}/api/v1/collections/adjustments/${id}`;

    try {
        const springRes = await fetch(targetUrl, {
            method: "PUT",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body),
        });

        if (!springRes.ok) {
            const errorText = await springRes.text();
            console.error("Spring Boot PUT Error:", errorText); // 🚀 Added logging
            throw new Error(errorText || "Spring Boot returned an error.");
        }

        return NextResponse.json({ message: "Updated" }, { status: 200 });
    } catch (err: unknown) {
        return NextResponse.json({ message: err instanceof Error ? err.message : String(err) }, { status: 500 });
    }
}

// 🚀 DELETE: Remove an Adjustment
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const cookieStore = await cookies();
    const token = cookieStore.get("vos_access_token")?.value;

    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const targetUrl = `${getSpringBaseUrl()}/api/v1/collections/adjustments/${id}`;

    try {
        const springRes = await fetch(targetUrl, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (!springRes.ok) {
            const errorText = await springRes.text();
            console.error("Spring Boot DELETE Error:", errorText); // 🚀 Added logging
            throw new Error(errorText || "Spring Boot returned an error.");
        }

        return NextResponse.json({ message: "Deleted" }, { status: 200 });
    } catch (err: unknown) {
        return NextResponse.json({ message: err instanceof Error ? err.message : String(err) }, { status: 500 });
    }
}