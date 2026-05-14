import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";

const getSpringBaseUrl = () => {
    const url = process.env.SPRING_API_BASE_URL;
    return (url || "http://localhost:8080").replace(/\/$/, "");
};

// 🚀 GET: Fetch a single pouch for Hydration
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> } // 🚀 Type changed to Promise
) {
    // 🚀 THE FIX: Await the params before accessing properties
    const { id } = await params;

    const cookieStore = await cookies();
    const token = cookieStore.get("vos_access_token")?.value;
    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const targetUrl = `${getSpringBaseUrl()}/api/v1/collections/${id}`;

    try {
        const res = await fetch(targetUrl, {
            headers: { "Authorization": `Bearer ${token}` },
            cache: "no-store",
        });

        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(errorText || `Backend error: ${res.status}`);
        }

        return NextResponse.json(await res.json());
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'An unknown error occurred';
        return NextResponse.json({ message }, { status: 500 });
    }
}

// 🚀 PUT: Update an existing Draft pouch
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> } // 🚀 Type changed to Promise
) {
    // 🚀 THE FIX: Await the params here too
    const { id } = await params;

    const cookieStore = await cookies();
    const token = cookieStore.get("vos_access_token")?.value;
    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const targetUrl = `${getSpringBaseUrl()}/api/v1/collections/${id}`;

    try {
        const res = await fetch(targetUrl, {
            method: "PUT",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        });

        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(errorText || `Update failed: ${res.status}`);
        }

        return NextResponse.json({ success: true });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'An unknown error occurred';
        return NextResponse.json({ message }, { status: 500 });
    }
}