// src/app/api/claims/generate-transmitter/supplier-representatives/route.ts
import { NextResponse } from "next/server";

const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const REPS_COLLECTION = "suppliers_representative";

type DirectusListResponse<T> = { data?: T[]; error?: unknown };

type SupplierRepresentativeRow = {
    id?: number | string | null;
    supplier_id?: number | string | null;
    first_name?: string | null;
    last_name?: string | null;
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
        const supplierId = (searchParams.get("supplier_id") ?? "").trim();
        const q = (searchParams.get("q") ?? "").trim();

        if (!supplierId || Number.isNaN(Number(supplierId))) {
            return NextResponse.json({ data: [] }, { status: 200 });
        }

        const params = new URLSearchParams();

        // show all when q is empty
        params.set("limit", q.length > 0 ? "20" : "-1");
        params.set("sort", "last_name,first_name");

        // ✅ only fetch what we need
        params.set("fields", "id,supplier_id,first_name,last_name");

        // always filter by supplier
        params.set("filter[supplier_id][_eq]", supplierId);

        // ✅ search only by name (no email/phone)
        if (q.length > 0) {
            params.set("filter[_or][0][last_name][_icontains]", q);
            params.set("filter[_or][1][first_name][_icontains]", q);
        }

        const url = `${DIRECTUS_URL}/items/${REPS_COLLECTION}?${params.toString()}`;
        const json = await fetchDirectus<DirectusListResponse<SupplierRepresentativeRow>>(url);

        return NextResponse.json({ data: json.data ?? [] }, { status: 200 });
    } catch (err: unknown) {
        return NextResponse.json(
            { error: "Unexpected error", details: errMessage(err) },
            { status: 500 }
        );
    }
}