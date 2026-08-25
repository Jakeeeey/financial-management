import { NextResponse } from "next/server";

export const runtime = "nodejs";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const AUTH_HEADERS = {
    Authorization: `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}`,
};

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const targetUrl = `${API_BASE_URL}/folders?${searchParams.toString()}`;

    try {
        const res = await fetch(targetUrl, {
            method: "GET",
            headers: AUTH_HEADERS,
            cache: "no-store",
        });

        if (!res.ok) {
            const error = await res.json().catch(() => ({ message: "Directus Error" }));
            return NextResponse.json(error, { status: res.status });
        }

        const data = await res.json();
        return NextResponse.json(data);
    } catch (err: unknown) {
        console.error("Folders Proxy Error:", err);
        return NextResponse.json({ message: "BFF Error", detail: err instanceof Error ? err.message : "Unknown error" }, { status: 502 });
    }
}
