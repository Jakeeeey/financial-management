import {NextResponse } from "next/server";
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

    const targetUrl = `${getSpringBaseUrl()}/api/chart-of-accounts`;

    try {
        const springRes = await fetch(targetUrl, {
            method: "GET",
            headers: { "Authorization": `Bearer ${token}` },
            cache: "no-store",
        });

        if (!springRes.ok) throw new Error(await springRes.text());
        return NextResponse.json(await springRes.json());
    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ message: "BFF Error", detail: errorMessage }, { status: 502 });
    }
}