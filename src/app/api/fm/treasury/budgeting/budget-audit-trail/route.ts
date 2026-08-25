import { NextResponse } from "next/server";

export const runtime = "nodejs";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const AUTH_HEADERS = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}`,
};

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const collection = searchParams.get("collection") || "budget_audit_trail";
    
    // Create a copy of search params to modify for the upstream request
    const query = new URLSearchParams(searchParams);
    query.delete("collection"); // Don't pass our internal collection param to Directus

    // Default fields for Audit Trail if not provided
    if (collection === "budget_audit_trail" && !query.has("fields")) {
        query.append("fields", "*,budget_id.*,budget_id.coa_id.*,budget_id.department_id.*,budget_id.division_id.*,performed_by.*");
    }

    // Default limit if not provided
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
            const error = await res.json().catch(() => ({ message: "Directus Error" }));
            return NextResponse.json(error, { status: res.status });
        }

        const data = await res.json();
        return NextResponse.json(data);
    } catch (err) {
        console.error(`GET ${collection} Proxy Error:`, err);
        return NextResponse.json({ message: "BFF Error", detail: err instanceof Error ? err.message : String(err) }, { status: 502 });
    }
}
