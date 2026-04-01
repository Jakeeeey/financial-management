// src/app/api/claims/generate-transmitter/suppliers/route.ts
import { NextResponse } from "next/server";

const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const SUPPLIERS_COLLECTION = "suppliers";

type DirectusListResponse<T> = { data?: T[]; error?: unknown };

type SupplierRow = {
    id?: number | string | null;
    supplier_name?: string | null;
    supplier_shortcut?: string | null;
    supplier_type?: string | null;
};

function errMessage(e: unknown): string {
    if (e && typeof e === "object" && "message" in e) {
        const msg = (e as { message?: unknown }).message;
        return typeof msg === "string" ? msg : String(msg ?? e);
    }
    return String(e);
}

async function fetchDirectus<T>(url: string): Promise<T> {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(await res.text());
    return (await res.json()) as T;
}

export async function GET(req: Request) {
    try {
        if (!DIRECTUS_URL) {
            return NextResponse.json({ error: "DIRECTUS_URL is not set" }, { status: 500 });
        }

        const { searchParams } = new URL(req.url);
        const q = (searchParams.get("q") ?? "").trim();

        // type-first behavior
        if (q.length < 1) return NextResponse.json({ data: [] }, { status: 200 });

        const params = new URLSearchParams();
        params.set("limit", "20");
        params.set("sort", "supplier_name");
        params.set("fields", "id,supplier_name,supplier_shortcut,supplier_type");
        params.set("filter[_or][0][supplier_name][_icontains]", q);
        params.set("filter[_or][1][supplier_shortcut][_icontains]", q);

        const url = `${DIRECTUS_URL}/items/${SUPPLIERS_COLLECTION}?${params.toString()}`;
        const json = await fetchDirectus<DirectusListResponse<SupplierRow>>(url);

        return NextResponse.json({ data: json.data ?? [] }, { status: 200 });
    } catch (err: unknown) {
        return NextResponse.json(
            { error: "Unexpected error", details: errMessage(err) },
            { status: 500 }
        );
    }
}