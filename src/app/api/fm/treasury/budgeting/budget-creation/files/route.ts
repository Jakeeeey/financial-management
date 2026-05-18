import { NextResponse } from "next/server";

export const runtime = "nodejs";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const AUTH_HEADERS = {
    Authorization: `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}`,
};

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        
        // Forward the request to Directus /files
        const res = await fetch(`${API_BASE_URL}/files`, {
            method: "POST",
            headers: AUTH_HEADERS,
            body: formData,
        });

        if (!res.ok) {
            const error = await res.json().catch(() => ({ message: "Directus Error" }));
            console.error("Files Proxy: Directus Error", error);
            return NextResponse.json(error, { status: res.status });
        }

        const data = await res.json();
        return NextResponse.json(data);
    } catch (err: unknown) {
        console.error("Files Proxy Error:", err);
        return NextResponse.json({ message: "BFF Error", detail: err instanceof Error ? err.message : "Unknown error" }, { status: 502 });
    }
}
