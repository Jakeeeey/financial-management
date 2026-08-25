import type { ItemAttribute, ItemAttributeValue } from "../utils/types";

const BASE = "/api/fm/procurement/items";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  const json = await res.json();
  if (!res.ok) {
    const detail = json.detail ?? json.message ?? res.statusText;
    throw new Error(typeof detail === "string" ? detail : "Request failed");
  }
  return json;
}

export async function listAttributes(): Promise<{ data: ItemAttribute[] }> {
  return request<{ data: ItemAttribute[] }>(`${BASE}/attributes`);
}

export async function createAttribute(data: {
  name: string;
  display_type: string;
}): Promise<{ data: ItemAttribute }> {
  return request<{ data: ItemAttribute }>(`${BASE}/attributes`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function createAttributeValue(data: {
  attribute_id: number;
  name: string;
  extra_price?: number;
}): Promise<{ data: ItemAttributeValue }> {
  return request<{ data: ItemAttributeValue }>(`${BASE}/attribute-values`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}
