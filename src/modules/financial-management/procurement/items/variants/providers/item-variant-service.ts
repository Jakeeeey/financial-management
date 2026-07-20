const BASE = "/api/fm/procurement/items/variants";

export async function listVariants(params?: { search?: string; page?: number; limit?: number }, signal?: AbortSignal) {
  const qs = new URLSearchParams();
  if (params?.search) qs.set("search", params.search);
  if (params?.page) qs.set("page", String(params.page));
  if (params?.limit) qs.set("limit", String(params.limit));

  const url = qs.toString() ? `${BASE}?${qs.toString()}` : BASE;
  const res = await fetch(url, { signal, cache: "no-store" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Failed to fetch variants" }));
    throw new Error(err.detail || err.message || `HTTP ${res.status}`);
  }
  return res.json() as Promise<{ data: import("../utils/types").ItemVariant[]; total?: number }>;
}

export async function getVariantById(id: number, signal?: AbortSignal) {
  const res = await fetch(`${BASE}/${id}`, { signal, cache: "no-store" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Failed to fetch variant" }));
    throw new Error(err.detail || err.message || `HTTP ${res.status}`);
  }
  return res.json() as Promise<{ data: import("../utils/types").ItemVariant & { valueIds?: number[] } }>;
}

export async function createVariant(payload: import("../utils/types").CreateVariantInput) {
  const res = await fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Failed to create variant" }));
    throw new Error(err.detail || err.message || `HTTP ${res.status}`);
  }
  return res.json() as Promise<{ data: import("../utils/types").ItemVariant }>;
}

export async function updateVariant(id: number, payload: Partial<import("../utils/types").CreateVariantInput & { active?: boolean }>) {
  const res = await fetch(`${BASE}/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Failed to update variant" }));
    throw new Error(err.detail || err.message || `HTTP ${res.status}`);
  }
  return res.json() as Promise<{ data: import("../utils/types").ItemVariant }>;
}

export async function listTemplatesLookup(signal?: AbortSignal) {
  const res = await fetch("/api/fm/procurement/items/templates?limit=-1&active_only=true", { signal, cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch templates");
  return res.json() as Promise<{ data: import("../utils/types").ItemTemplateLookup[]; total?: number }>;
}

export async function listAttributes(signal?: AbortSignal) {
  const res = await fetch(`/api/fm/procurement/items/attributes?limit=-1`, { signal, cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch attributes");
  return res.json() as Promise<{ data: import("../utils/types").ItemAttribute[] }>;
}

export async function listAttributeValues(signal?: AbortSignal) {
  const res = await fetch(`/api/fm/procurement/items/attribute-values?limit=-1`, { signal, cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch attribute values");
  return res.json() as Promise<{ data: import("../utils/types").ItemAttributeValue[] }>;
}
