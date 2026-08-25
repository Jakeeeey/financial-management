import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";

const DIRECTUS_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN || "";

// Account type IDs allowed for payable line selections
const PAYABLE_ACCOUNT_TYPES = [3, 4, 7, 8, 9, 10];

interface DirectusCoa {
    coa_id: number;
    gl_code: string;
    account_title: string;
    account_type?: number | null;
    isPayment?: { type: string; data: number[] } | number | null;
    is_payment?: { type: string; data: number[] } | number | null;
}

function resolveBuffer(val: { type: string; data: number[] } | number | null | undefined): boolean {
    if (!val) return false;
    if (typeof val === "number") return val === 1;
    if (typeof val === "object" && val.type === "Buffer") return (val.data?.[0] ?? 0) === 1;
    return false;
}

export async function GET(request: NextRequest) {
    const cookieStore = await cookies();
    const token = cookieStore.get("vos_access_token")?.value;

    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const forPayable = searchParams.get("forPayable") === "true";

    try {
        if (!DIRECTUS_URL) throw new Error("NEXT_PUBLIC_API_BASE_URL is not configured");
        if (!DIRECTUS_TOKEN) throw new Error("DIRECTUS_STATIC_TOKEN is not configured");

        const params = new URLSearchParams();
        params.set("limit", "-1");
        params.set("sort", "gl_code");
        params.set("fields", "coa_id,gl_code,account_title,account_type,isPayment,is_payment");
        params.set("filter[account_title][_nnull]", "true");

        if (forPayable) {
            params.set("filter[account_type][_in]", PAYABLE_ACCOUNT_TYPES.join(","));
        }

        const directusRes = await fetch(`${DIRECTUS_URL}/items/chart_of_accounts?${params.toString()}`, {
            headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
            cache: "no-store",
        });

        if (!directusRes.ok) throw new Error(await directusRes.text());

        const data = ((await directusRes.json()).data || []) as DirectusCoa[];

        const mapped = data.map((row) => ({
            coaId: row.coa_id,
            glCode: row.gl_code,
            accountTitle: row.account_title,
            accountType: row.account_type ?? null,
            isPayment: resolveBuffer(row.isPayment),
            isPaymentDuplicate: resolveBuffer(row.is_payment),
        }));

        return NextResponse.json(mapped);
    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ message: "BFF Error", detail: errorMessage }, { status: 502 });
    }
}