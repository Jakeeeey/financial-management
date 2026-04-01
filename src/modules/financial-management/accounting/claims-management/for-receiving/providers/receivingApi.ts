//src/modules/financial-management/claims-management/for-receiving/providers/receivingApi.ts
import type { CompanyProfile, TransmittalDetailRow, TransmittalRow } from "../utils/types";

async function readText(res: Response): Promise<string> {
    try {
        return await res.text();
    } catch {
        return "";
    }
}

function isRecord(v: unknown): v is Record<string, unknown> {
    return typeof v === "object" && v !== null;
}

function pickDataArray<T>(json: unknown): T[] {
    if (!isRecord(json)) return [];
    const data = json["data"];
    return Array.isArray(data) ? (data as T[]) : [];
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
    const res = await fetch(url, { method: "GET", cache: "no-store", signal });
    if (!res.ok) {
        const t = await readText(res);
        throw new Error(t || `Request failed: ${res.status}`);
    }
    const json: unknown = await res.json();
    return json as T;
}

async function postJson<T>(url: string, body: unknown, signal?: AbortSignal): Promise<T> {
    const res = await fetch(url, {
        method: "POST",
        cache: "no-store",
        signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const t = await readText(res);
        throw new Error(t || `Request failed: ${res.status}`);
    }
    const json: unknown = await res.json();
    return json as T;
}

async function deleteJson<T>(url: string, signal?: AbortSignal): Promise<T> {
    const res = await fetch(url, { method: "DELETE", cache: "no-store", signal });
    if (!res.ok) {
        const t = await readText(res);
        throw new Error(t || `Request failed: ${res.status}`);
    }
    // Directus DELETE sometimes returns empty body
    const text = await readText(res);
    return (text ? (JSON.parse(text) as T) : ({} as T));
}

export async function fetchCompanyProfile(signal?: AbortSignal): Promise<CompanyProfile | null> {
    const json = await getJson<{ data: CompanyProfile | null }>("/api/company", signal);
    return json.data ?? null;
}

/**
 * LIST (Left panel)
 * GET /api/claims/for-receiving/transmittal-send-to-payment
 * (server filters status = FOR RECEIVING)
 */
export async function fetchForReceivingTransmittals(
    args: { q?: string; supplier_id?: number | null },
    signal?: AbortSignal
): Promise<TransmittalRow[]> {
    const sp = new URLSearchParams();
    if (args.q) sp.set("q", args.q);
    if (args.supplier_id) sp.set("supplier_id", String(args.supplier_id));

    const url = `/api/fm/accounting/claims/for-receiving/transmittal-send-to-payment?${sp.toString()}`;
    const json = await getJson<{ data: TransmittalRow[] }>(url, signal);
    return json.data ?? [];
}

/**
 * DETAILS
 * GET /api/claims/for-receiving/transmit-details?transmittal_id=
 */
export async function fetchTransmittalDetails(
    transmittalId: number,
    signal?: AbortSignal
): Promise<TransmittalDetailRow[]> {
    const url = `/api/fm/accounting/claims/for-receiving/transmit-details?transmittal_id=${encodeURIComponent(
        String(transmittalId)
    )}`;
    const json = await getJson<{ data: TransmittalDetailRow[] }>(url, signal);
    return json.data ?? [];
}

/**
 * REMOVE LINE
 * DELETE /api/claims/for-receiving/transmittal-receive-line?detail_id=
 */
export async function removeDetailLine(
    detail_id: number,
    signal?: AbortSignal
): Promise<{ ok: boolean }> {
    const url = `/api/fm/accounting/claims/for-receiving/transmittal-receive-line?detail_id=${encodeURIComponent(
        String(detail_id)
    )}`;
    const json = await deleteJson<{ data?: { ok: boolean } }>(url, signal);
    return json?.data ?? { ok: true };
}

/**
 * SEND TO PAYMENT
 * POST /api/claims/for-receiving/transmittal-send-to-payment
 */
export async function sendTransmittalToPayment(
    transmittal_id: number,
    signal?: AbortSignal
): Promise<{ ok: boolean }> {
    const json = await postJson<{ data: { ok: boolean } }>(
        "/api/fm/accounting/claims/for-receiving/transmittal-send-to-payment",
        { transmittal_id },
        signal
    );
    return json.data;
}

/**
 * AVAILABLE CCMs
 * GET /api/claims/for-receiving/ccm?supplier_id=...&q=...&exclude_ids=...
 */
export async function fetchAvailableCCMs(
    args: { supplierId: number; q?: string; excludeIds?: number[] },
    signal?: AbortSignal
): Promise<
    Array<{
        id: number;
        memo_number?: string | null;
        reason?: string | null;
        amount?: string | number | null;
        supplier_id?: number | null;
        customer_id?: number | null;
        customer_name?: string | null;
    }>
> {
    const params = new URLSearchParams();
    params.set("supplier_id", String(args.supplierId));
    if (args.q) params.set("q", args.q);
    if (args.excludeIds?.length) params.set("exclude_ids", args.excludeIds.join(","));

    const url = `/api/fm/accounting/claims/for-receiving/ccm?${params.toString()}`;

    type AvailableCCM = {
        id: number;
        memo_number?: string | null;
        reason?: string | null;
        amount?: string | number | null;
        supplier_id?: number | null;
        customer_id?: number | null;
        customer_name?: string | null;
    };

    const json: unknown = await getJson<unknown>(url, signal);
    return pickDataArray<AvailableCCM>(json);
}

/**
 * ADD CCMs (bulk)
 * POST /api/claims/for-receiving/transmit-details
 */
export async function addCCMsToTransmittal(
    transmittalId: number,
    customerMemoIds: number[],
    signal?: AbortSignal
): Promise<void> {
    await postJson<unknown>(
        "/api/fm/accounting/claims/for-receiving/transmit-details",
        {
            claims_transmittal_id: transmittalId,
            customer_memo_ids: customerMemoIds,
        },
        signal
    );
}

/**
 * MARK RECEIVED (optional)
 * POST /api/claims/for-receiving/transmittal-receive-line
 */
export async function markDetailReceived(
    payload: { transmittal_id: number; detail_id: number; received_at?: string | null },
    signal?: AbortSignal
): Promise<{ ok: boolean; remaining: number }> {
    const json = await postJson<{ data: { ok: boolean; remaining: number } }>(
        "/api/fm/accounting/claims/for-receiving/transmittal-receive-line",
        payload,
        signal
    );
    return json.data;
}