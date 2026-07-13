import type { Supplier, ItemTemplate, ItemVariant, Unit } from "../utils/types";

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { method: "GET", cache: "no-store", signal });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Lookup failed (${res.status}): ${text}`);
  }
  return (await res.json()) as T;
}

export async function searchSuppliers(q: string, signal?: AbortSignal): Promise<Supplier[]> {
  const url = `/api/fm/procurement/approval/lookups/suppliers?q=${encodeURIComponent(q)}`;
  const json = await getJson<{ data: Supplier[] }>(url, signal);
  return json.data ?? [];
}

export async function listItemTemplates(q: string, signal?: AbortSignal): Promise<ItemTemplate[]> {
  const url = `/api/fm/procurement/approval/lookups/items?q=${encodeURIComponent(q)}`;
  const json = await getJson<{ data: ItemTemplate[] }>(url, signal);
  return json.data ?? [];
}

export async function listItemVariants(templateId: number, signal?: AbortSignal): Promise<ItemVariant[]> {
  const url = `/api/fm/procurement/approval/lookups/variants?item_tmpl_id=${templateId}`;
  const json = await getJson<{ data: ItemVariant[] }>(url, signal);
  return json.data ?? [];
}

export async function listUnits(signal?: AbortSignal): Promise<Unit[]> {
  const url = `/api/fm/procurement/approval/lookups/units`;
  const json = await getJson<{ data: Unit[] }>(url, signal);
  return json.data ?? [];
}
