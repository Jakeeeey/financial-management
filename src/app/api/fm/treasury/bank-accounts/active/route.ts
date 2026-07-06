import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";

const DIRECTUS_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN || "";

export async function GET() {
    const cookieStore = await cookies();
    const token = cookieStore.get("vos_access_token")?.value;

    if (!token) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const targetUrl = `${DIRECTUS_URL}/items/bank_accounts?filter[is_active][_eq]=1&sort=bank_name&limit=-1`;

    try {
        const directusRes = await fetch(targetUrl, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${DIRECTUS_TOKEN}`,
                "Content-Type": "application/json"
            },
            cache: "no-store",
        });

        if (!directusRes.ok) {
            const errorText = await directusRes.text();
            throw new Error(errorText || `Directus GET Error: ${directusRes.status}`);
        }

        const json = await directusRes.json();
        const normalized = (json.data || []).map((b: { bank_id?: unknown; bank_name?: unknown; account_number?: unknown }) => ({
            bankId: b.bank_id ? Number(b.bank_id) : 0,
            bankName: b.bank_name ? String(b.bank_name) : "",
            accountNumber: b.account_number ? String(b.account_number) : ""
        })).filter((b: { bankId: number }) => b.bankId > 0);

        return NextResponse.json(normalized);
    } catch (err: unknown) {
        console.error("[BFF GET Active Banks Directus Exception]:", err);
        return NextResponse.json({
            message: "BFF Directus Error",
            detail: (err instanceof Error ? err.message : String(err))
        }, { status: 502 });
    }
}