const BASE = "/api/fm/procurement/items/templates";

export async function listTemplates(params?: { search?: string; page?: number; limit?: number }, signal?: AbortSignal) {
  const qs = new URLSearchParams();
  if (params?.search) qs.set("search", params.search);
  if (params?.page) qs.set("page", String(params.page));
  if (params?.limit) qs.set("limit", String(params.limit));

  const url = qs.toString() ? `${BASE}?${qs.toString()}` : BASE;
  const res = await fetch(url, { signal, cache: "no-store" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Failed to fetch templates" }));
    throw new Error(err.detail || err.message || `HTTP ${res.status}`);
  }
  return res.json() as Promise<{ data: import("../utils/types").ItemTemplate[]; total?: number }>;
}

export async function getTemplateById(id: number, signal?: AbortSignal) {
  const res = await fetch(`${BASE}/${id}`, { signal, cache: "no-store" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Failed to fetch template" }));
    throw new Error(err.detail || err.message || `HTTP ${res.status}`);
  }
  return res.json() as Promise<{ data: import("../utils/types").ItemTemplate }>;
}

export async function createTemplate(payload: import("../utils/types").CreateTemplateInput) {
  const res = await fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Failed to create template" }));
    throw new Error(err.detail || err.message || `HTTP ${res.status}`);
  }
  return res.json() as Promise<{ data: import("../utils/types").ItemTemplate }>;
}

export async function updateTemplate(id: number, payload: Partial<import("../utils/types").CreateTemplateInput & { is_active?: boolean }>) {
  const res = await fetch(`${BASE}/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Failed to update template" }));
    throw new Error(err.detail || err.message || `HTTP ${res.status}`);
  }
  return res.json() as Promise<{ data: import("../utils/types").ItemTemplate }>;
}

export async function listUnits(signal?: AbortSignal) {
  const res = await fetch("/api/fm/procurement/approval/lookups/units", { signal, cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch units");
  return res.json() as Promise<{ data: import("../utils/types").Unit[] }>;
}
