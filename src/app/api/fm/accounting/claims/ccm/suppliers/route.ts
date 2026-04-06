import { NextResponse } from "next/server";

const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const SUPPLIER_COLLECTION = "suppliers";

type DirectusListResponse<T> = { data: T[] };

type SupplierDirectusRow = {
    id: number | string;
    supplier_name?: string | null;
    supplier_shortcut?: string | null;
};

type SupplierOption = {
    id: number;
    label: string;
    shortcut: string | null;
};

async function fetchDirectus<T>(url: string): Promise<T> {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Directus error ${res.status}: ${text}`);
    }
    return (await res.json()) as T;
}

function errMessage(err: unknown): string {
    if (err && typeof err === "object" && "message" in err) {
        const msg = (err as { message?: unknown }).message;
        return typeof msg === "string" ? msg : String(msg ?? err);
    }
    return String(err);
}

export async function GET(req: Request) {
    try {
        if (!DIRECTUS_URL) {
            return NextResponse.json({ error: "DIRECTUS_URL is not set" }, { status: 500 });
        }

        const { searchParams } = new URL(req.url);
        const q = (searchParams.get("q") ?? "").trim();

        // Require typing first
        if (q.length < 2) {
            return NextResponse.json({ data: [] }, { status: 200 });
        }

        const params = new URLSearchParams();
        params.set("limit", "20");
        params.set("sort", "supplier_name");
        params.set("fields", "id,supplier_name,supplier_shortcut");

        // search name OR shortcut
        params.set("filter[_or][0][supplier_name][_icontains]", q);
        params.set("filter[_or][1][supplier_shortcut][_icontains]", q);

        const url = `${DIRECTUS_URL}/items/${SUPPLIER_COLLECTION}?${params.toString()}`;
        const json = await fetchDirectus<DirectusListResponse<SupplierDirectusRow>>(url);

        const data: SupplierOption[] = (json.data ?? []).map((s) => ({
            id: Number(s.id),
            label: String(s.supplier_name ?? s.supplier_shortcut ?? `#${s.id}`),
            shortcut: s.supplier_shortcut ? String(s.supplier_shortcut) : null,
        }));

        return NextResponse.json({ data }, { status: 200 });
    } catch (err: unknown) {
        return NextResponse.json(
            { error: "Unexpected error", details: errMessage(err) },
            { status: 500 }
        );
    }
}