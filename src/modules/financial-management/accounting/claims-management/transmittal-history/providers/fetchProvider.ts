// src/modules/claims-management/transmittal-history/providers/fetchProvider.ts
import type { TransmittalHistoryRow } from "../types";

/* =========================
   Types (no any)
========================= */

type ApiHistoryResponse = {
    data?: unknown;
    meta?: unknown;
    total?: unknown;
    page?: unknown;
    limit?: unknown;
};

type ApiDetailsItem = {
    id?: unknown;
    customer_memo_id?: unknown;
    memo_number?: unknown;
    reason?: unknown;
    amount?: unknown;
    received_at?: unknown;
    remarks?: unknown;
};

type ApiHistoryItem = {
    id?: unknown;
    transmittal_no?: unknown;
    supplier_id?: unknown;
    supplier_name?: unknown;
    supplier_representative_id?: unknown;
    representative_name?: unknown;
    created_at?: unknown;
    status?: unknown;
    transmittal_status?: unknown;
    claims_transmittal_status?: unknown;
    total_amount?: unknown;
    ccm_count?: unknown;
    details?: unknown;
};

export type TransmittalHistoryPagedResult = {
    rows: TransmittalHistoryRow[];
    total: number;
};

/* =========================
   Guards / coercers
========================= */

function isRecord(v: unknown): v is Record<string, unknown> {
    return typeof v === "object" && v !== null;
}

function toNumber(v: unknown, fallback = 0): number {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : fallback;
}

function toString(v: unknown, fallback = "—"): string {
    if (typeof v === "string") {
        const s = v.trim();
        return s.length ? s : fallback;
    }
    if (v == null) return fallback;
    const s = String(v).trim();
    return s.length ? s : fallback;
}

/**
 * Some fields in your row types are `string` (not nullable).
 * If backend gives null/undefined, we still must return a string.
 */
function toStringNullable(v: unknown): string | null {
    return typeof v === "string" ? v : v == null ? null : String(v);
}

function asApiHistoryItem(v: unknown): ApiHistoryItem {
    return isRecord(v) ? (v as ApiHistoryItem) : {};
}

function asApiDetailsItem(v: unknown): ApiDetailsItem {
    return isRecord(v) ? (v as ApiDetailsItem) : {};
}

function readMetaFilterCount(meta: unknown): number {
    if (!isRecord(meta)) return 0;
    return toNumber(meta["filter_count"], 0);
}

/* =========================
   Mapping (STRICT output)
========================= */

function mapApiToRow(raw: unknown): TransmittalHistoryRow {
    const t = asApiHistoryItem(raw);

    const rawDetails = Array.isArray(t.details) ? t.details : [];
    const details = rawDetails.map((dUnknown) => {
        const d = asApiDetailsItem(dUnknown);
        return {
            id: toNumber(d.id, 0),
            customer_memo_id: toNumber(d.customer_memo_id, 0),
            memo_number: toString(d.memo_number, "—"),
            // if your type expects string (not nullable), swap toStringNullable -> toString
            reason: toStringNullable(d.reason),
            amount: toNumber(d.amount ?? 0, 0),
            received_at: toStringNullable(d.received_at),
            remarks: toStringNullable(d.remarks),
        };
    });

    const computedTotal =
        details.length > 0
            ? details.reduce((sum, x) => sum + toNumber(x.amount, 0), 0)
            : toNumber(t.total_amount, 0);

    const status =
        toString(t.status, "") ||
        toString(t.transmittal_status, "") ||
        toString(t.claims_transmittal_status, "") ||
        "—";

    const supplierId = toNumber(t.supplier_id, 0);
    const repId = toNumber(t.supplier_representative_id, 0);

    return {
        id: toNumber(t.id, 0),
        transmittal_no: toString(t.transmittal_no, "—"),
        supplier_id: supplierId,
        supplier_name: toString(t.supplier_name, `Supplier #${supplierId || "—"}`),
        supplier_representative_id: repId,
        representative_name: toString(t.representative_name, `Representative #${repId || "—"}`),
        created_at: toString(t.created_at, "—"),
        status, // ✅ IMPORTANT
        total_amount: computedTotal,
        ccm_count: typeof t.ccm_count === "number" ? t.ccm_count : details.length,
        details,
    };
}

/* =========================
   Fetch
========================= */

/**
 * GET /api/fm/claims/transmittal-history?q=&status=&date_from=&date_to=&page=&limit=
 */
const API_BASE = "/api/fm/accounting/claims/transmittal-history";

async function fetchHistory(
    params?: {
        q?: string;
        status?: string;
        date_from?: string;
        date_to?: string;
        page?: number;
        limit?: number;
    },
    signal?: AbortSignal
): Promise<ApiHistoryResponse> {
    const sp = new URLSearchParams();

    if (params?.q) sp.set("q", params.q);
    if (params?.status) sp.set("status", params.status);
    if (params?.date_from) sp.set("date_from", params.date_from);
    if (params?.date_to) sp.set("date_to", params.date_to);
    if (typeof params?.page === "number") sp.set("page", String(params.page));
    if (typeof params?.limit === "number") sp.set("limit", String(params.limit));

    const url = `${API_BASE}${sp.toString() ? `?${sp.toString()}` : ""}`;

    const res = await fetch(url, { method: "GET", cache: "no-store", signal });

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Failed to load transmittal history (HTTP ${res.status}). ${text}`);
    }

    const json: unknown = await res.json().catch(() => ({}));
    return isRecord(json) ? (json as ApiHistoryResponse) : {};
}

/* =========================
   Public API
========================= */

export async function getTransmittalHistoryPaged(
    params?: {
        q?: string;
        status?: string;
        date_from?: string;
        date_to?: string;
        page?: number;
        limit?: number;
    },
    signal?: AbortSignal
): Promise<TransmittalHistoryPagedResult> {
    const json = await fetchHistory(params, signal);

    const rawRows = Array.isArray(json.data) ? json.data : [];
    const rows = rawRows.map(mapApiToRow);

    const total = toNumber(json.total, readMetaFilterCount(json.meta));

    return { rows, total };
}

export async function getTransmittalHistory(
    params?: {
        q?: string;
        status?: string;
        date_from?: string;
        date_to?: string;
        page?: number;
        limit?: number;
    },
    signal?: AbortSignal
): Promise<TransmittalHistoryRow[]> {
    const r = await getTransmittalHistoryPaged(params, signal);
    return r.rows;
}