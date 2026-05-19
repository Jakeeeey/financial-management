import { NextResponse } from "next/server";

export const runtime = "nodejs";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const AUTH_HEADERS = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}`,
};

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const collection = searchParams.get("collection") || "budget";
    
    // Create a copy of search params to modify for the upstream request
    const query = new URLSearchParams(searchParams);
    query.delete("collection"); // Remove internal proxy collection routing param

    // Set default relational deep-fetch fields for budget history aggregation if not supplied
    if (collection === "budget" && !query.has("fields")) {
        query.append("fields", "*,coa_id.*,department_id.*,division_id.*");
    }

    // Default to retrieve all matched historic rows
    if (!query.has("limit")) {
        query.append("limit", "-1");
    }

    const targetUrl = `${API_BASE_URL}/items/${collection}?${query.toString()}`;

    try {
        const res = await fetch(targetUrl, {
            method: "GET",
            headers: AUTH_HEADERS,
            cache: "no-store",
        });

        if (!res.ok) {
            const error = await res.json().catch(() => ({ message: "Directus Upstream Error" }));
            return NextResponse.json(error, { status: res.status });
        }

        const data = await res.json();
        return NextResponse.json(data);
    } catch (err: unknown) {
        console.error(`GET ${collection} Proxy Error:`, err);
        const detail = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ message: "BFF Proxy Error", detail }, { status: 502 });
    }
}
