const BASE = "/api/fm/procurement/purchase-order";

export async function listPOs(params?: { search?: string; status?: string; page?: number; limit?: number }, signal?: AbortSignal) {
  const qs = new URLSearchParams();
  if (params?.search) qs.set("search", params.search);
  if (params?.status) qs.set("status", params.status);
  if (params?.page) qs.set("page", String(params.page));
  if (params?.limit) qs.set("limit", String(params.limit));

  const url = qs.toString() ? `${BASE}?${qs.toString()}` : BASE;
  const res = await fetch(url, { signal, cache: "no-store" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Failed to fetch POs" }));
    throw new Error(err.detail || err.message || `HTTP ${res.status}`);
  }
  return res.json() as Promise<{ data: import("../utils/types").PurchaseOrder[]; total?: number }>;
}

export async function getPOById(id: number, signal?: AbortSignal) {
  const res = await fetch(`${BASE}/${id}`, { signal, cache: "no-store" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Failed to fetch PO" }));
    throw new Error(err.detail || err.message || `HTTP ${res.status}`);
  }
  return res.json() as Promise<{ data: { po: import("../utils/types").PurchaseOrder; items: import("../utils/types").PurchaseOrderItem[]; received?: Record<number, number> } }>;
}
