import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";

const getSpringBaseUrl = () => {
    const url = process.env.SPRING_API_BASE_URL;
    return (url || "http://localhost:8080").replace(/\/$/, "");
};

export async function GET() {
    const cookieStore = await cookies();
    const token = cookieStore.get("vos_access_token")?.value;

    if (!token) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const targetUrl = `${getSpringBaseUrl()}/api/v1/treasury/bank-accounts/active`;

    try {
        const springRes = await fetch(targetUrl, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            cache: "no-store", // Ensure we always get the freshest list of active banks
        });

        if (!springRes.ok) {
            const errorText = await springRes.text();
            throw new Error(errorText || `Spring GET Error: ${springRes.status}`);
        }

        const data = await springRes.json();
        return NextResponse.json(data);
    } catch (err: unknown) {
        console.error("[BFF GET Active Banks Exception]:", err);
        return NextResponse.json({
            message: "BFF Error",
            detail: (err instanceof Error ? err.message : String(err))
        }, { status: 502 });
    }
}