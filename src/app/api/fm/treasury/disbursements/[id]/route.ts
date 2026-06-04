import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";

const getSpringBaseUrl = () => {
    const url = process.env.SPRING_API_BASE_URL;
    return (url || "http://localhost:8080").replace(/\/$/, "");
};

// 🚀 FIX: Typed params as a Promise
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const cookieStore = await cookies();
    const token = cookieStore.get("vos_access_token")?.value;

    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    // 🚀 FIX: Await the params before extracting the ID!
    const resolvedParams = await params;
    const id = resolvedParams.id;

    const body = await request.json();
    const targetUrl = `${getSpringBaseUrl()}/api/disbursements/${id}`;

    try {
        // Fetch current status from Directus to see if it is "Approved"
        const directusUrl = `${(process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "")}/items/disbursement/${id}`;
        const directusToken = process.env.DIRECTUS_STATIC_TOKEN || "";
        let currentStatus = "";
        try {
            const directusRes = await fetch(directusUrl, {
                headers: {
                    Authorization: `Bearer ${directusToken}`,
                    "Content-Type": "application/json",
                },
                cache: "no-store",
            });
            if (directusRes.ok) {
                const disData = await directusRes.json();
                currentStatus = disData?.data?.status || "";
            }
        } catch (e) {
            console.error("Failed to fetch current status for edit check", e);
        }

        const springRes = await fetch(targetUrl, {
            method: "PUT",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body),
        });

        if (!springRes.ok) throw new Error(await springRes.text());
        const resultJson = await springRes.json();

        // If the disbursement was already Approved, send it back to approval (status "Submitted")
        if (currentStatus === "Approved") {
            const statusUrl = `${getSpringBaseUrl()}/api/disbursements/${id}/status?status=Submitted`;
            try {
                const statusRes = await fetch(statusUrl, {
                    method: "PATCH",
                    headers: {
                        "Authorization": `Bearer ${token}`,
                        "Content-Type": "application/json"
                    }
                });
                if (!statusRes.ok) {
                    console.error("Failed to reset status to Submitted after edit:", await statusRes.text());
                }
            } catch (e) {
                console.error("Error resetting status to Submitted after edit:", e);
            }
        }

        return NextResponse.json(resultJson);
    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ message: "BFF Error", detail: errorMessage }, { status: 502 });
    }
}