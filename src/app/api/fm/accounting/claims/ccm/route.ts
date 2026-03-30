//src/app/api/claims/ccm/route.ts
import { NextResponse } from "next/server";

const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

const CCM_COLLECTION = "customers_memo";
const SUPPLIER_COLLECTION = "suppliers";
const CUSTOMER_COLLECTION = "customer";

type DirectusListResponse<T> = {
    data: T[];
    meta?: {
        filter_count?: number;
        [key: string]: unknown;
    };
};

type CcmRow = {
    id: number;
    memo_number: string | null;
    reason: string | null;
    status: string | null;
    amount: number | null;
    applied_amount: number | null;
    supplier_id: number | null;
    customer_id: number | null;
    salesman_id: number | null;
    chart_of_account: number | null;
    type: string | null;
    customer_reference: string | null;
    supplier_reference: string | null;
    encoder_id: number | null;
    isClaimed: boolean | null;
    isPending: boolean | null;
    created_at: string | null;
    updated_at: string | null;
};

type SupplierRow = {
    id: number;
    supplier_name: string | null;
    supplier_shortcut: string | null;
};

type CustomerRow = {
    id: number;
    customer_name: string | null;
    customer_code: string | null;
    store_signage: string | null;
};



type TransmittalDetailRow = {
    customer_memo_id: number;
    claims_transmittal_id: {
        status: string;
    } | number | null;
};

function toBool(v: unknown): boolean {
    if (v === true || v === "true" || v === 1 || v === "1") return true;
    if (v && typeof v === "object" && !("status" in (v as Record<string, unknown>))) {
        const obj = v as { type?: string; data?: number[] };
        if (obj.type === "Buffer" && Array.isArray(obj.data) && obj.data.length > 0) {
            return obj.data[0] === 1;
        }
    }
    return false;
}

function uniqNums(values: Array<number | null | undefined>): number[] {
    return Array.from(
        new Set(values.filter((v): v is number => typeof v === "number" && Number.isFinite(v))),
    );
}

async function fetchDirectusItems<T>(
    collection: string,
    params: URLSearchParams,
): Promise<DirectusListResponse<T>> {
    if (!DIRECTUS_URL) {
        throw new Error("DIRECTUS_URL is not set");
    }

    const url = `${DIRECTUS_URL}/items/${collection}?${params.toString()}`;
    const res = await fetch(url, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Directus error (${collection}) ${res.status}: ${text}`);
    }

    return (await res.json()) as DirectusListResponse<T>;
}

export async function GET(req: Request) {
    try {
        if (!DIRECTUS_URL) {
            return NextResponse.json({ error: "DIRECTUS_URL is not set" }, { status: 500 });
        }

        const { searchParams } = new URL(req.url);

        const q = (searchParams.get("q") ?? "").trim();
        const status = (searchParams.get("status") ?? "").trim();
        const supplierId = (searchParams.get("supplier_id") ?? "").trim();
        const customerId = (searchParams.get("customer_id") ?? "").trim();

        const pending = searchParams.get("pending");
        const claimed = searchParams.get("claimed");

        const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
        const pageSize = Math.min(100, Math.max(5, Number(searchParams.get("pageSize") ?? "20")));
        const offset = (page - 1) * pageSize;

        const ccmParams = new URLSearchParams();
        ccmParams.set("limit", String(pageSize));
        ccmParams.set("offset", String(offset));
        ccmParams.set("sort", "-created_at");
        ccmParams.set("meta", "filter_count");

        ccmParams.set(
            "fields",
            [
                "id",
                "memo_number",
                "reason",
                "status",
                "amount",
                "applied_amount",
                "supplier_id",
                "customer_id",
                "salesman_id",
                "chart_of_account",
                "type",
                "customer_reference",
                "supplier_reference",
                "encoder_id",
                "isClaimed",
                "isPending",
                "created_at",
                "updated_at",
            ].join(","),
        );

        // Prepare CCM filters
        if (q) {
            ccmParams.set("filter[_or][0][memo_number][_icontains]", q);
            ccmParams.set("filter[_or][1][reason][_icontains]", q);
        }

        if (supplierId && !Number.isNaN(Number(supplierId))) {
            ccmParams.set("filter[supplier_id][_eq]", supplierId);
        }

        if (customerId && !Number.isNaN(Number(customerId))) {
            ccmParams.set("filter[customer_id][_eq]", customerId);
        }

        if (pending === "1") {
            ccmParams.set("filter[isPending][_eq]", "true");
        } else if (pending === "0") {
            ccmParams.set("filter[isPending][_eq]", "false");
        }

        if (claimed === "1") {
            ccmParams.set("filter[isClaimed][_eq]", "true");
        } else if (claimed === "0") {
            ccmParams.set("filter[isClaimed][_neq]", "true");
        }

        // Logic for specific status filtering that requires transmittal info
        if (status === "FOR RECEIVING" || status === "FOR PAYMENT") {
            // 1. Fetch ALL matching pending CCM IDs first
            const idOnlyParams = new URLSearchParams(ccmParams);
            idOnlyParams.set("fields", "id");
            idOnlyParams.delete("limit");
            idOnlyParams.delete("offset");
            idOnlyParams.set("limit", "1000"); // Reasonable limit for active CCMs
            idOnlyParams.set("filter[_and][0][isPending][_eq]", "true");
            idOnlyParams.set("filter[_and][1][isClaimed][_neq]", "true");

            const idRes = await fetchDirectusItems<CcmRow>(CCM_COLLECTION, idOnlyParams);
            const allCandidateIds = (idRes.data ?? []).map(r => r.id);

            if (allCandidateIds.length === 0) {
                return NextResponse.json({ data: [], meta: { filter_count: 0 } }, { status: 200 });
            }

            // 2. Fetch transmittal statuses for ALL candidates
            const transmittalStatusByMemoId = new Map<number, string>();
            const tp = new URLSearchParams();
            tp.set("fields", "customer_memo_id,claims_transmittal_id.status");
            tp.set("filter[customer_memo_id][_in]", allCandidateIds.join(","));
            tp.set("limit", String(allCandidateIds.length));

            const transRes = await fetchDirectusItems<TransmittalDetailRow>("claims_transmittal_details", tp);
            for (const item of transRes.data ?? []) {
                const ct = item.claims_transmittal_id;
                if (item.customer_memo_id && ct && typeof ct === "object" && ct.status) {
                    transmittalStatusByMemoId.set(item.customer_memo_id, ct.status);
                }
            }

            // 3. Filter IDs in-memory based on calculated status
            const filteredIds = allCandidateIds.filter(id => {
                const tStatus = transmittalStatusByMemoId.get(id);
                let calc = tStatus || "FOR RECEIVING";
                if (calc === "DRAFT") calc = "FOR RECEIVING";
                
                return calc === status;
            });

            const totalFilteredCount = filteredIds.length;

            // 4. Slice for pagination
            const pagedIds = filteredIds.slice(offset, offset + pageSize);

            if (pagedIds.length === 0) {
                return NextResponse.json({ data: [], meta: { filter_count: totalFilteredCount } }, { status: 200 });
            }

            // 5. Fetch full data for only the paged IDs
            const finalParams = new URLSearchParams(ccmParams);
            finalParams.set("fields", ccmParams.get("fields")!);
            finalParams.set("filter[id][_in]", pagedIds.join(","));
            // Clear other filters that were already applied to get the IDs
            finalParams.delete("limit");
            finalParams.delete("offset");
            finalParams.set("limit", String(pageSize));

            const finalRes = await fetchDirectusItems<CcmRow>(CCM_COLLECTION, finalParams);
            const ccmRows = finalRes.data ?? [];

            // 6. Enrich and return
            const enriched = await enrichCcmRows(ccmRows, transmittalStatusByMemoId);
            return NextResponse.json({ data: enriched, meta: { filter_count: totalFilteredCount } }, { status: 200 });
        }

        // Standard filtering (PENDING, POSTED, or other raw status)
        if (status === "PENDING") {
            ccmParams.set("filter[_and][0][isPending][_neq]", "true");
            ccmParams.set("filter[_and][1][isClaimed][_neq]", "true");
        } else if (status === "POSTED") {
            ccmParams.set("filter[_and][0][isPending][_eq]", "true");
            ccmParams.set("filter[_and][1][isClaimed][_eq]", "true");
        } else if (status) {
            ccmParams.set("filter[status][_eq]", status);
        }

        const ccmRes = await fetchDirectusItems<CcmRow>(CCM_COLLECTION, ccmParams);
        const ccmRows: CcmRow[] = ccmRes.data ?? [];
        const ccmIds = ccmRows.map((r) => r.id);

        const transmittalStatusByMemoId = new Map<number, string>();
        if (ccmIds.length > 0) {
            const tp = new URLSearchParams();
            tp.set("fields", "customer_memo_id,claims_transmittal_id.status");
            tp.set("filter[customer_memo_id][_in]", ccmIds.join(","));
            tp.set("limit", "1000");

            const transRes = await fetchDirectusItems<TransmittalDetailRow>(
                "claims_transmittal_details",
                tp,
            );
            for (const item of transRes.data ?? []) {
                const ct = item.claims_transmittal_id;
                if (item.customer_memo_id && ct && typeof ct === "object" && ct.status) {
                    transmittalStatusByMemoId.set(item.customer_memo_id, ct.status);
                }
            }
        }

        const enriched = await enrichCcmRows(ccmRows, transmittalStatusByMemoId);

        return NextResponse.json(
            {
                data: enriched,
                meta: ccmRes.meta ?? {},
            },
            { status: 200 },
        );
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);

        return NextResponse.json(
            { error: "Unexpected error", details: message },
            { status: 500 },
        );
    }
}

async function enrichCcmRows(ccmRows: CcmRow[], transmittalStatusByMemoId: Map<number, string>) {
    const supplierIds = uniqNums(
        ccmRows.map((row) => (typeof row.supplier_id === "number" ? row.supplier_id : null)),
    );
    const customerIds = uniqNums(
        ccmRows.map((row) => (typeof row.customer_id === "number" ? row.customer_id : null)),
    );

    const supplierNameById = new Map<number, string>();
    const customerNameById = new Map<number, string>();

    if (supplierIds.length > 0) {
        const sp = new URLSearchParams();
        sp.set("fields", "id,supplier_name,supplier_shortcut");
        sp.set("limit", String(Math.min(500, supplierIds.length)));
        sp.set("filter[id][_in]", supplierIds.join(","));

        const suppliersRes = await fetchDirectusItems<SupplierRow>(SUPPLIER_COLLECTION, sp);

        for (const supplier of suppliersRes.data ?? []) {
            if (typeof supplier.id === "number") {
                supplierNameById.set(
                    supplier.id,
                    String(
                        supplier.supplier_name ??
                            supplier.supplier_shortcut ??
                            `#${supplier.id}`,
                    ),
                );
            }
        }
    }

    if (customerIds.length > 0) {
        const cp = new URLSearchParams();
        cp.set("fields", "id,customer_name,customer_code,store_signage");
        cp.set("limit", String(Math.min(500, customerIds.length)));
        cp.set("filter[id][_in]", customerIds.join(","));

        const customersRes = await fetchDirectusItems<CustomerRow>(CUSTOMER_COLLECTION, cp);

        for (const customer of customersRes.data ?? []) {
            if (typeof customer.id === "number") {
                customerNameById.set(
                    customer.id,
                    String(
                        customer.customer_name ??
                            customer.store_signage ??
                            customer.customer_code ??
                            `#${customer.id}`,
                    ),
                );
            }
        }
    }

    return ccmRows.map((row) => {
        const sid = typeof row.supplier_id === "number" ? row.supplier_id : null;
        const cid = typeof row.customer_id === "number" ? row.customer_id : null;

        const isPending = toBool(row.isPending);
        const isClaimed = toBool(row.isClaimed);

        let calculatedStatus = "PENDING";
        if (isPending && isClaimed) {
            calculatedStatus = "POSTED";
        } else if (isPending && !isClaimed) {
            const tStatus = transmittalStatusByMemoId.get(row.id);
            calculatedStatus = tStatus || "FOR RECEIVING";
            if (calculatedStatus === "DRAFT") calculatedStatus = "FOR RECEIVING";
        } else {
            calculatedStatus = "PENDING";
        }

        return {
            ...row,
            status: calculatedStatus,
            supplier_name: sid ? (supplierNameById.get(sid) ?? null) : null,
            customer_name: cid ? (customerNameById.get(cid) ?? null) : null,
        };
    });
}