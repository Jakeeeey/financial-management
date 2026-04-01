//src/modules/financial-management-system/claims-management/ccm-list/providers/lookupsService.ts
export type LookupItem = { id: number; label: string; code?: string | null; shortcut?: string | null };

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
    const res = await fetch(url, { method: "GET", cache: "no-store", signal });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Lookup failed (${res.status}): ${text}`);
    }
    return (await res.json()) as T;
}

export async function searchSuppliers(q: string, signal?: AbortSignal) {
    const url = `/api/fm/accounting/claims/ccm/suppliers?q=${encodeURIComponent(q)}`;
    const json = await getJson<{ data: LookupItem[] }>(url, signal);
    return json.data ?? [];
}

export async function searchCustomers(q: string, signal?: AbortSignal) {
    const url = `/api/fm/accounting/claims/ccm/customers?q=${encodeURIComponent(q)}`;
    const json = await getJson<{ data: LookupItem[] }>(url, signal);
    return json.data ?? [];
}
export async function getChartOfAccount(coaId: number, signal?: AbortSignal) {
    const url = `/api/fm/accounting/claims/ccm/chart-of-accounts?id=${encodeURIComponent(String(coaId))}`;
    const json = await getJson<{ data: Array<{ id: number; account_title: string | null; gl_code: string | null }> }>(
        url,
        signal
    );
    return json.data?.[0] ?? null;
}

export async function getBalanceType(typeId: number, signal?: AbortSignal) {
    const url = `/api/fm/accounting/claims/ccm/balance-types?id=${encodeURIComponent(String(typeId))}`;
    const json = await getJson<{ data: Array<{ id: number; balance_name: string | null }> }>(url, signal);
    return json.data?.[0] ?? null;
}
