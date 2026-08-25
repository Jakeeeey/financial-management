import { NextResponse } from "next/server";

export const runtime = "nodejs";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const AUTH_HEADERS = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}`,
};

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    if (!searchParams.has("limit")) {
        searchParams.set("limit", "-1");
    }

    const targetUrl = `${API_BASE_URL}/items/department_division_coa?${searchParams.toString()}`;

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
    } catch (err) {
        return NextResponse.json({ message: "BFF Error", detail: err instanceof Error ? err.message : String(err) }, { status: 502 });
    }
}
