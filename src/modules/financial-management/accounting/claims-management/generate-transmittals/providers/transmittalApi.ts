// src/modules/financial-management-system/claims-management/generate-transmittals/providers/transmittalApi.ts
import type { CCMRow, CreateTransmittalResult, PickItem } from "../utils/types";

/* =========================
   Helpers (no any)
========================= */

function isRecord(v: unknown): v is Record<string, unknown> {
    return typeof v === "object" && v !== null;
}

function toNumber(v: unknown, fallback = 0): number {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : fallback;
}

function toStringSafe(v: unknown): string {
    if (typeof v === "string") return v;
    if (v == null) return "";
    return String(v);
}

function safeName(v: unknown): string {
    return toStringSafe(v).trim();
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
    const res = await fetch(url, { method: "GET", cache: "no-store", signal });
    if (!res.ok) throw new Error(await res.text());
    const data: unknown = await res.json();
    return data as T;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
    const res = await fetch(url, {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(await res.text());
    const data: unknown = await res.json();
    return data as T;
}

/* =========================
   API shapes (unknown-safe)
========================= */

type SupplierApiRow = {
    id?: unknown;
    supplier_name?: unknown;
    supplier_shortcut?: unknown;
};

type SupplierRepApiRow = {
    id?: unknown;
    first_name?: unknown;
    last_name?: unknown;
};

/* =========================
   Functions
========================= */

export async function searchSuppliers(q: string, signal?: AbortSignal): Promise<PickItem[]> {
    const url = `/api/fm/accounting/claims/generate-transmitter/suppliers-search?q=${encodeURIComponent(q)}`;

    const json = await getJson<{ data?: unknown }>(url, signal);
    const list = Array.isArray(json.data) ? json.data : [];

    return list.map((raw): PickItem => {
        const s: SupplierApiRow = isRecord(raw) ? (raw as SupplierApiRow) : {};

        const supplierName = safeName(s.supplier_name);
        const supplierShortcut = safeName(s.supplier_shortcut);

        const label =
            supplierShortcut.length > 0
                ? `${supplierName} (${supplierShortcut})`
                : supplierName;

        return { id: toNumber(s.id), label };
    });
}

export async function searchSupplierRepresentatives(
    supplierId: number,
    q: string,
    signal?: AbortSignal
): Promise<PickItem[]> {
    const term = String(q ?? "").trim();

    const base =
        `/api/fm/accounting/claims/generate-transmitter/supplier-representatives` +
        `?supplier_id=${encodeURIComponent(String(supplierId))}`;

    // attach q only when typed
    const url = term.length > 0 ? `${base}&q=${encodeURIComponent(term)}` : base;

    const json = await getJson<{ data?: unknown }>(url, signal);
    const list = Array.isArray(json.data) ? json.data : [];

    return list.map((raw): PickItem => {
        const r: SupplierRepApiRow = isRecord(raw) ? (raw as SupplierRepApiRow) : {};

        const first = safeName(r.first_name);
        const last = safeName(r.last_name);

        const full = `${first} ${last}`.trim();
        const id = toNumber(r.id);

        const label = full.length > 0 ? full : `Rep #${id}`;

        return { id, label };
    });
}

export async function fetchAvailableCCMsBySupplier(
    supplierId: number,
    signal?: AbortSignal
): Promise<CCMRow[]> {
    const url = `/api/fm/accounting/claims/generate-transmitter/ccm-available?supplier_id=${encodeURIComponent(
        String(supplierId)
    )}`;

    const json = await getJson<{ data?: unknown }>(url, signal);
    const data = json.data;

    // We trust backend to return CCMRow[] for this endpoint.
    return Array.isArray(data) ? (data as CCMRow[]) : [];
}

export async function createTransmittal(payload: {
    supplier_id: number;
    supplier_representative_id: number;
    customer_memo_ids: number[];
}): Promise<CreateTransmittalResult> {
    const json = await postJson<{ data?: unknown }>(
        "/api/fm/accounting/claims/generate-transmitter/transmittals",
        payload
    );

    if (!isRecord(json) || json.data == null) {
        throw new Error("Invalid response from createTransmittal");
    }

    return json.data as CreateTransmittalResult;
}