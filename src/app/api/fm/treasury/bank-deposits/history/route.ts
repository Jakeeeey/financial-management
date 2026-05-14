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

    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    try {
        const springRes = await fetch(`${getSpringBaseUrl()}/api/v1/treasury/bank-deposits/history`, {
            method: "GET",
            headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
            cache: "no-store",
        });

        if (!springRes.ok) throw new Error(`Spring GET Error: ${springRes.status}`);
        return NextResponse.json(await springRes.json());
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'An unknown error occurred';
        return NextResponse.json({ message }, { status: 500 });
    }
}