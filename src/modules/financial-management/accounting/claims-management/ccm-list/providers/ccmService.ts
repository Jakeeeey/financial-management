
//src/modules/financial-management-system/claims-management/ccm-list/providers/ccmService.ts
import type { CCMListQuery, CCMListResponse } from "../utils/types";

function qs(query: CCMListQuery) {
    const p = new URLSearchParams();
    if (query.q) p.set("q", query.q);
    if (query.status) p.set("status", query.status);
    if (query.supplier_id) p.set("supplier_id", query.supplier_id);
    if (query.customer_id) p.set("customer_id", query.customer_id);
    if (query.pending) p.set("pending", query.pending);
    if (query.claimed) p.set("claimed", query.claimed);
    if (query.page) p.set("page", String(query.page));
    if (query.pageSize) p.set("pageSize", String(query.pageSize));
    return p.toString();
}

export async function fetchCCMList(
    query: CCMListQuery,
    signal?: AbortSignal
): Promise<CCMListResponse> {
    const url = `/api/fm/accounting/claims/ccm?${qs(query)}`;

    const res = await fetch(url, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        signal,
        cache: "no-store",
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to fetch CCM list (${res.status}): ${text}`);
    }

    return (await res.json()) as CCMListResponse;
}
