import { NextResponse } from "next/server";

export const runtime = "nodejs";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const AUTH_HEADERS = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}`,
};

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const res = await fetch(`${API_BASE_URL}/items/budget_attachments?${searchParams.toString()}`, {
            method: "GET",
            headers: AUTH_HEADERS,
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

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const res = await fetch(`${API_BASE_URL}/items/budget_attachments`, {
            method: "POST",
            headers: AUTH_HEADERS,
            body: JSON.stringify(body),
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

export async function DELETE(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get("id");
        if (!id) return NextResponse.json({ message: "ID is required" }, { status: 400 });

        // 1. Fetch the attachment record to get directus_id (the actual file UUID)
        const fetchRes = await fetch(`${API_BASE_URL}/items/budget_attachments/${id}?fields=directus_id`, {
            method: "GET",
            headers: AUTH_HEADERS,
        });

        let directusFileId: string | null = null;
        if (fetchRes.ok) {
            const record = await fetchRes.json();
            directusFileId = record?.data?.directus_id || null;
        }

        // 2. Delete the budget_attachments record
        const deleteRes = await fetch(`${API_BASE_URL}/items/budget_attachments/${id}`, {
            method: "DELETE",
            headers: AUTH_HEADERS,
        });

        if (!deleteRes.ok) {
            const error = await deleteRes.json().catch(() => ({ message: "Directus Error" }));
            return NextResponse.json(error, { status: deleteRes.status });
        }

        // 3. Delete the actual file from Directus storage
        if (directusFileId) {
            await fetch(`${API_BASE_URL}/files/${directusFileId}`, {
                method: "DELETE",
                headers: AUTH_HEADERS,
            }).catch((err) => {
                console.error("Failed to delete Directus file:", err);
            });
        }

        return new Response(null, { status: 204 });
    } catch (err) {
        return NextResponse.json({ message: "BFF Error", detail: err instanceof Error ? err.message : String(err) }, { status: 502 });
    }
}
