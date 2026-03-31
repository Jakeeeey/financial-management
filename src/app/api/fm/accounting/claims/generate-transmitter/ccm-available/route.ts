// src/app/api/claims/generate-transmitter/ccm-available/route.ts
import { NextResponse } from "next/server";

const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

const CCM_COLLECTION = "customers_memo";
const COA_COLLECTION = "chart_of_accounts";
const CUSTOMER_COLLECTION = "customer";

function directusHeaders() {
    if (!DIRECTUS_URL) throw new Error("DIRECTUS_URL is not configured");
    if (!TOKEN) throw new Error("DIRECTUS_SERVICE_TOKEN is not configured");
    return {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TOKEN}`,
    };
}

type DirectusListResponse<T> = { data?: T[]; error?: unknown };

type CCMRow = {
    id?: number | string | null;
    memo_number?: string | null;
    reason?: string | null;
    status?: string | null;
    amount?: number | string | null;
    supplier_id?: number | string | null;
    customer_id?: number | string | null;
    chart_of_account?: number | string | null;
    isPending?: unknown;
    isClaimed?: unknown;
    created_at?: string | null;
};

type COARow = {
    coa_id?: number | string | null;
    gl_code?: string | null;
    account_title?: string | null;
};

type CustomerRow = {
    id?: number | string | null;
    customer_name?: string | null;
};



function isRecord(v: unknown): v is Record<string, unknown> {
    return !!v && typeof v === "object" && !Array.isArray(v);
}

function errMessage(e: unknown): string {
    if (isRecord(e) && "message" in e) {
        const msg = e.message;
        return typeof msg === "string" ? msg : String(msg ?? e);
    }
    return String(e);
}

async function fetchDirectus<T>(url: string): Promise<T> {
    const res = await fetch(url, { cache: "no-store", headers: directusHeaders() });

    const text = await res.text();
    let jsonUnknown: unknown = {};
    try {
        jsonUnknown = text ? (JSON.parse(text) as unknown) : {};
    } catch {
        jsonUnknown = { raw: text };
    }

    if (!res.ok) throw new Error(JSON.stringify(jsonUnknown));
    return jsonUnknown as T;
}

export async function GET(req: Request) {
    try {
        if (!DIRECTUS_URL) {
            return NextResponse.json({ error: "DIRECTUS_URL is not set" }, { status: 500 });
        }

        const { searchParams } = new URL(req.url);
        const supplierId = (searchParams.get("supplier_id") ?? "").trim();

        if (!supplierId || Number.isNaN(Number(supplierId))) {
            return NextResponse.json({ data: [] }, { status: 200 });
        }

        // 1) Fetch available CCMs
        const params = new URLSearchParams();
        params.set("limit", "200");
        params.set("sort", "-created_at");
        params.set(
            "fields",
            [
                "id",
                "memo_number",
                "reason",
                "status",
                "amount",
                "supplier_id",
                "customer_id",
                "chart_of_account", // ✅ your COA FK
                "isPending",
                "isClaimed",
                "created_at",
            ].join(",")
        );

        // supplier filter
        params.set("filter[supplier_id][_eq]", supplierId);

        // isPending: NULL OR 0 OR false
        params.set("filter[_and][0][_or][0][isPending][_null]", "true");
        params.set("filter[_and][0][_or][1][isPending][_eq]", "0");
        params.set("filter[_and][0][_or][2][isPending][_eq]", "false");

        // isClaimed: NULL OR 0 OR false
        params.set("filter[_and][1][_or][0][isClaimed][_null]", "true");
        params.set("filter[_and][1][_or][1][isClaimed][_eq]", "0");
        params.set("filter[_and][1][_or][2][isClaimed][_eq]", "false");

        const ccmUrl = `${DIRECTUS_URL}/items/${CCM_COLLECTION}?${params.toString()}`;
        const ccmJson = await fetchDirectus<DirectusListResponse<CCMRow>>(ccmUrl);

        const rows = Array.isArray(ccmJson?.data) ? ccmJson.data : [];

        // 2) Collect COA IDs and Customer IDs
        const coaIds = Array.from(
            new Set(
                rows
                    .map((r) => Number(r?.chart_of_account))
                    .filter((n) => Number.isFinite(n) && n > 0)
            )
        );

        const customerIds = Array.from(
            new Set(
                rows
                    .map((r) => Number(r?.customer_id))
                    .filter((n) => Number.isFinite(n) && n > 0)
            )
        );

        // 3) Batch fetch COA details
        const coaMap = new Map<number, { gl_code: string | null; account_title: string | null }>();

        if (coaIds.length > 0) {
            const coaParams = new URLSearchParams();
            coaParams.set("limit", String(Math.max(50, coaIds.length)));
            coaParams.set("fields", "coa_id,gl_code,account_title");
            coaParams.set("filter[coa_id][_in]", coaIds.join(","));

            const coaUrl = `${DIRECTUS_URL}/items/${COA_COLLECTION}?${coaParams.toString()}`;
            const coaJson = await fetchDirectus<DirectusListResponse<COARow>>(coaUrl);

            for (const c of Array.isArray(coaJson?.data) ? coaJson.data : []) {
                const id = Number(c?.coa_id);
                if (!Number.isFinite(id) || id <= 0) continue;
                coaMap.set(id, {
                    gl_code: typeof c?.gl_code === "string" ? c.gl_code : null,
                    account_title: typeof c?.account_title === "string" ? c.account_title : null,
                });
            }
        }

        // 4) Batch fetch Customer names
        const customerMap = new Map<number, string>();

        if (customerIds.length > 0) {
            const custParams = new URLSearchParams();
            custParams.set("limit", String(Math.max(50, customerIds.length)));
            custParams.set("fields", "id,customer_name");
            custParams.set("filter[id][_in]", customerIds.join(","));

            const custUrl = `${DIRECTUS_URL}/items/${CUSTOMER_COLLECTION}?${custParams.toString()}`;
            const custJson = await fetchDirectus<DirectusListResponse<CustomerRow>>(custUrl);

            for (const c of Array.isArray(custJson?.data) ? custJson.data : []) {
                const id = Number(c?.id);
                if (!Number.isFinite(id) || id <= 0) continue;
                const name = typeof c?.customer_name === "string" ? c.customer_name.trim() : "";
                if (name) customerMap.set(id, name);
            }
        }

        // 5) Return rows + convenience fields for frontend table
        const data = rows.map((r) => {
            const coaId = Number(r?.chart_of_account);
            const coa = Number.isFinite(coaId) ? coaMap.get(coaId) : undefined;

            const custId = Number(r?.customer_id);
            const custName = Number.isFinite(custId) ? customerMap.get(custId) : undefined;

            return {
                ...r,

                // ✅ normalized fields for frontend display/filter
                coa_id: Number.isFinite(coaId) ? coaId : null,
                gl_code: coa?.gl_code ?? null,
                account_title: coa?.account_title ?? null,

                customer_name: custName ?? null,
            };
        });

        return NextResponse.json({ data }, { status: 200 });
    } catch (err: unknown) {
        return NextResponse.json(
            { error: "Unexpected error", details: errMessage(err) },
            { status: 500 }
        );
    }
}