import type {
  CreateTemplateInput,
  CreateVariantInput,
  ItemAttribute,
  ItemAttributeValue,
  ItemTemplate,
  ItemTemplateLookup,
  ItemVariant,
  Unit,
} from "@/modules/financial-management/procurement/items/utils/types";

const TEMPLATES_BASE = "/api/fm/procurement/items/templates";
const VARIANTS_BASE = "/api/fm/procurement/items/variants";

function parseErrorPayload(res: Response, fallback: string): Promise<Error> {
  return res
    .json()
    .catch(() => ({ message: fallback }))
    .then((err: { detail?: string; message?: string }) => new Error(err.detail || err.message || `HTTP ${res.status}`));
}

export async function listItems(
  params?: { search?: string; page?: number; limit?: number; activeOnly?: boolean },
  signal?: AbortSignal
): Promise<{ data: ItemTemplate[]; total?: number }> {
  try {
    const qs = new URLSearchParams();
    if (params?.search) qs.set("search", params.search);
    if (params?.page) qs.set("page", String(params.page));
    if (params?.limit) qs.set("limit", String(params.limit));
    if (params?.activeOnly) qs.set("active_only", "true");

    const url = qs.toString() ? `${TEMPLATES_BASE}?${qs.toString()}` : TEMPLATES_BASE;
    const res = await fetch(url, { signal, cache: "no-store" });
    if (!res.ok) throw await parseErrorPayload(res, "Failed to fetch items");
    return res.json() as Promise<{ data: ItemTemplate[]; total?: number }>;
  } catch (err) {
    if (signal?.aborted) throw err;
    console.error("[items service] listItems", err);
    throw err;
  }
}

export async function getItemById(id: number, signal?: AbortSignal): Promise<{ data: ItemTemplate }> {
  try {
    const res = await fetch(`${TEMPLATES_BASE}/${id}`, { signal, cache: "no-store" });
    if (!res.ok) throw await parseErrorPayload(res, "Failed to fetch item");
    return res.json() as Promise<{ data: ItemTemplate }>;
  } catch (err) {
    if (signal?.aborted) throw err;
    console.error("[items service] getItemById", err);
    throw err;
  }
}

export async function createItem(payload: CreateTemplateInput): Promise<{ data: ItemTemplate }> {
  try {
    const res = await fetch(TEMPLATES_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw await parseErrorPayload(res, "Failed to create item");
    return res.json() as Promise<{ data: ItemTemplate }>;
  } catch (err) {
    console.error("[items service] createItem", err);
    throw err;
  }
}

export async function updateItem(
  id: number,
  payload: Partial<CreateTemplateInput & { is_active?: boolean }>,
  signal?: AbortSignal
): Promise<{ data: ItemTemplate }> {
  try {
    const res = await fetch(`${TEMPLATES_BASE}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal,
    });
    if (!res.ok) throw await parseErrorPayload(res, "Failed to update item");
    return res.json() as Promise<{ data: ItemTemplate }>;
  } catch (err) {
    if (signal?.aborted) throw err;
    console.error("[items service] updateItem", err);
    throw err;
  }
}

export async function listVariantsByItem(templateId: number, signal?: AbortSignal): Promise<{ data: ItemVariant[]; total?: number }> {
  try {
    const res = await fetch(`${VARIANTS_BASE}?item_tmpl_id=${templateId}`, { signal, cache: "no-store" });
    if (!res.ok) throw await parseErrorPayload(res, "Failed to fetch variants");
    return res.json() as Promise<{ data: ItemVariant[]; total?: number }>;
  } catch (err) {
    if (signal?.aborted) throw err;
    console.error("[items service] listVariantsByItem", err);
    throw err;
  }
}

export async function listVariants(
  params?: { search?: string; page?: number; limit?: number },
  signal?: AbortSignal
): Promise<{ data: ItemVariant[]; total?: number }> {
  try {
    const qs = new URLSearchParams();
    if (params?.search) qs.set("search", params.search);
    if (params?.page) qs.set("page", String(params.page));
    if (params?.limit) qs.set("limit", String(params.limit));

    const url = qs.toString() ? `${VARIANTS_BASE}?${qs.toString()}` : VARIANTS_BASE;
    const res = await fetch(url, { signal, cache: "no-store" });
    if (!res.ok) throw await parseErrorPayload(res, "Failed to fetch variants");
    return res.json() as Promise<{ data: ItemVariant[]; total?: number }>;
  } catch (err) {
    if (signal?.aborted) throw err;
    console.error("[items service] listVariants", err);
    throw err;
  }
}

export async function getVariantById(
  id: number,
  signal?: AbortSignal
): Promise<{ data: ItemVariant & { valueIds?: number[] } }> {
  try {
    const res = await fetch(`${VARIANTS_BASE}/${id}`, { signal, cache: "no-store" });
    if (!res.ok) throw await parseErrorPayload(res, "Failed to fetch variant");
    return res.json() as Promise<{ data: ItemVariant & { valueIds?: number[] } }>;
  } catch (err) {
    if (signal?.aborted) throw err;
    console.error("[items service] getVariantById", err);
    throw err;
  }
}

export async function deleteVariant(id: number, signal?: AbortSignal): Promise<{ ok: boolean }> {
  try {
    const res = await fetch(`${VARIANTS_BASE}/${id}`, { method: "DELETE", signal });
    if (!res.ok) throw await parseErrorPayload(res, "Failed to delete variant");
    return { ok: true };
  } catch (err) {
    if (signal?.aborted) throw err;
    console.error("[items service] deleteVariant", err);
    throw err;
  }
}

export async function createVariant(payload: CreateVariantInput): Promise<{ data: ItemVariant }> {
  try {
    const res = await fetch(VARIANTS_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw await parseErrorPayload(res, "Failed to create variant");
    return res.json() as Promise<{ data: ItemVariant }>;
  } catch (err) {
    console.error("[items service] createVariant", err);
    throw err;
  }
}

export async function updateVariant(
  id: number,
  payload: Partial<CreateVariantInput & { active?: boolean }>,
  signal?: AbortSignal
): Promise<{ data: ItemVariant }> {
  try {
    const res = await fetch(`${VARIANTS_BASE}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal,
    });
    if (!res.ok) throw await parseErrorPayload(res, "Failed to update variant");
    return res.json() as Promise<{ data: ItemVariant }>;
  } catch (err) {
    if (signal?.aborted) throw err;
    console.error("[items service] updateVariant", err);
    throw err;
  }
}

export async function listUnits(signal?: AbortSignal): Promise<{ data: Unit[] }> {
  try {
    const res = await fetch("/api/fm/procurement/items/units", { signal, cache: "no-store" });
    if (!res.ok) throw await parseErrorPayload(res, "Failed to fetch units");
    return res.json() as Promise<{ data: Unit[] }>;
  } catch (err) {
    if (signal?.aborted) throw err;
    console.error("[items service] listUnits", err);
    throw err;
  }
}

export async function listTemplatesLookup(signal?: AbortSignal): Promise<{ data: ItemTemplateLookup[]; total?: number }> {
  try {
    const res = await fetch(`${TEMPLATES_BASE}?limit=-1&active_only=true`, { signal, cache: "no-store" });
    if (!res.ok) throw await parseErrorPayload(res, "Failed to fetch templates");
    return res.json() as Promise<{ data: ItemTemplateLookup[]; total?: number }>;
  } catch (err) {
    if (signal?.aborted) throw err;
    console.error("[items service] listTemplatesLookup", err);
    throw err;
  }
}

export async function listAttributes(signal?: AbortSignal): Promise<{ data: ItemAttribute[] }> {
  try {
    const res = await fetch("/api/fm/procurement/items/attributes?limit=-1", { signal, cache: "no-store" });
    if (!res.ok) throw await parseErrorPayload(res, "Failed to fetch attributes");
    return res.json() as Promise<{ data: ItemAttribute[] }>;
  } catch (err) {
    if (signal?.aborted) throw err;
    console.error("[items service] listAttributes", err);
    throw err;
  }
}

export async function listAttributeValues(signal?: AbortSignal): Promise<{ data: ItemAttributeValue[] }> {
  try {
    const res = await fetch("/api/fm/procurement/items/attribute-values?limit=-1", { signal, cache: "no-store" });
    if (!res.ok) throw await parseErrorPayload(res, "Failed to fetch attribute values");
    return res.json() as Promise<{ data: ItemAttributeValue[] }>;
  } catch (err) {
    if (signal?.aborted) throw err;
    console.error("[items service] listAttributeValues", err);
    throw err;
  }
}
