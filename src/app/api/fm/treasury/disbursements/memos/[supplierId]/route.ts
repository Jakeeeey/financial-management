import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";

const DIRECTUS_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN || "";

interface DirectusMemo {
    id: number;
    memo_number: string;
    type: number;
    date: string;
    amount: number;
    reason?: string | null;
    chart_of_account?: any;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ supplierId: string }> }) {
    const cookieStore = await cookies();
    const token = cookieStore.get("vos_access_token")?.value;

    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const resolvedParams = await params;
    const supplierId = Number(resolvedParams.supplierId);

    try {
        const queryParams = new URLSearchParams({
            filter: JSON.stringify({
                _and: [
                    { supplier_id: { _eq: supplierId } },
                    { status: { _nin: ["USED", "CANCELLED"] } }
                ]
            }),
            fields: "id,memo_number,type,date,amount,reason,chart_of_account",
            sort: "-date",
            limit: "-1"
        });

        const directusRes = await fetch(`${DIRECTUS_URL}/items/suppliers_memo?${queryParams.toString()}`, {
            headers: {
                Authorization: `Bearer ${DIRECTUS_TOKEN}`,
            },
            cache: "no-store",
        });

        if (!directusRes.ok) throw new Error(await directusRes.text());
        const rawData = ((await directusRes.json()).data || []) as DirectusMemo[];

        // Extract COA IDs
        const coaIds = Array.from(new Set(
            rawData
                .map(row => {
                    if (row.chart_of_account && typeof row.chart_of_account === "object") {
                        return Number(row.chart_of_account.coa_id);
                    }
                    return row.chart_of_account ? Number(row.chart_of_account) : null;
                })
                .filter((id): id is number => id !== null && !isNaN(id))
        ));

        const coaMap = new Map<number, { coa_id: number; account_title: string }>();

        if (coaIds.length > 0) {
            const coaRes = await fetch(`${DIRECTUS_URL}/items/chart_of_accounts?filter[coa_id][_in]=${coaIds.join(",")}&fields=coa_id,account_title`, {
                headers: {
                    Authorization: `Bearer ${DIRECTUS_TOKEN}`,
                },
                cache: "no-store",
            });
            if (coaRes.ok) {
                const coaData = ((await coaRes.json()).data || []) as { coa_id: number; account_title: string }[];
                for (const coa of coaData) {
                    coaMap.set(Number(coa.coa_id), coa);
                }
            }
        }

        const mapped = rawData.map((row: DirectusMemo) => {
            let coaId: number | null = null;
            let accountTitle = "";

            if (row.chart_of_account) {
                if (typeof row.chart_of_account === "object") {
                    coaId = Number(row.chart_of_account.coa_id) || null;
                    accountTitle = row.chart_of_account.account_title || "";
                } else {
                    coaId = Number(row.chart_of_account) || null;
                    const coa = coaId ? coaMap.get(coaId) : null;
                    if (coa) {
                        accountTitle = coa.account_title || "";
                    }
                }
            }

            return {
                id: row.id,
                memo_number: row.memo_number,
                type: row.type,
                memo_type_name: Number(row.type) === 1 ? "CREDIT MEMO" : Number(row.type) === 2 ? "DEBIT MEMO" : "UNKNOWN",
                date: row.date,
                amount: Number(row.amount) || 0,
                reason: row.reason || "",
                coa_id: coaId,
                account_title: accountTitle
            };
        });

        return NextResponse.json(mapped);
    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
        return NextResponse.json({ message: "BFF Error", detail: errorMessage }, { status: 502 });
    }
}