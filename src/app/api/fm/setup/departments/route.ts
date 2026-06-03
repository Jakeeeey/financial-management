import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
    const directusBase = process.env.NEXT_PUBLIC_API_BASE_URL;
    const directusToken = process.env.DIRECTUS_STATIC_TOKEN;

    if (!directusBase || !directusToken) {
        return NextResponse.json({ message: "Directus configuration is missing" }, { status: 500 });
    }

    try {
        const params = new URLSearchParams({
            fields: "department_id,department_name,parent_division",
            sort: "department_name",
            limit: "-1",
        });
        const directusRes = await fetch(`${directusBase.replace(/\/$/, "")}/items/department?${params.toString()}`, {
            headers: { Authorization: `Bearer ${directusToken}` },
            cache: "no-store",
        });

        if (!directusRes.ok) {
            const message = await directusRes.text();
            return NextResponse.json({ message }, { status: directusRes.status });
        }

        const json = await directusRes.json();
        return NextResponse.json(json.data ?? []);
    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
        return NextResponse.json({ message: errorMessage }, { status: 502 });
    }
}
