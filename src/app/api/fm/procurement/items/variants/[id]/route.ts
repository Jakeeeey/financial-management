import { NextRequest, NextResponse } from "next/server";
import { UpdateVariantSchema } from "@/modules/financial-management/procurement/items/utils/schemas";

export const runtime = "nodejs";
const DIRECTUS_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN || "";

function sortedCombo(valueIds: number[]): number[] {
  return [...valueIds].sort((a, b) => a - b);
}

function sameCombo(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

function resolveUomId(raw: unknown): number | null {
  if (typeof raw === "number") return raw;
  if (raw && typeof raw === "object") {
    const unitId = (raw as Record<string, unknown>).unit_id;
    if (typeof unitId === "number") return unitId;
  }
  return null;
}

async function resolveVariantValueIds(variantId: number): Promise<number[]> {
  const relParams = new URLSearchParams({
    "filter[item_variant_id][_eq]": String(variantId),
    fields: "item_attribute_value_id",
    limit: "-1",
  });
  const relRes = await fetch(
    `${DIRECTUS_URL}/items/item_attribute_value_item_variant_rel?${relParams.toString()}`,
    { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` }, cache: "no-store" }
  );
  if (!relRes.ok) return [];
  const relJson = await relRes.json();
  return ((relJson.data || []) as Record<string, unknown>[])
    .map((rel) => (typeof rel.item_attribute_value_id === "number" ? rel.item_attribute_value_id : 0))
    .filter((v) => v > 0);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Fetch the variant
    const res = await fetch(`${DIRECTUS_URL}/items/item_variant/${id}?fields=*,item_tmpl_id.id,item_tmpl_id.name,uom_id.unit_id,uom_id.unit_name,uom_id.unit_shortcut`, {
      headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(await res.text());
    const json = await res.json();
    const r = json.data as Record<string, unknown>;
    const tmpl = r.item_tmpl_id as Record<string, unknown> | null;
    const unit = r.uom_id as Record<string, unknown> | null;

    // Fetch the variant's attribute value relations
    const relParams = new URLSearchParams({
      "filter[item_variant_id][_eq]": id,
      fields: "item_attribute_value_id",
    });
    const relRes = await fetch(
      `${DIRECTUS_URL}/items/item_attribute_value_item_variant_rel?${relParams.toString()}`,
      { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` }, cache: "no-store" }
    );
    let valueIds: number[] = [];
    if (relRes.ok) {
      const relJson = await relRes.json();
      valueIds = ((relJson.data || []) as Record<string, unknown>[]).map(
        (rel) => (typeof rel.item_attribute_value_id === "number" ? rel.item_attribute_value_id : 0)
      ).filter(Boolean);
    }

    const resolved = {
      ...r,
      item_tmpl_id: typeof r.item_tmpl_id === "number" ? r.item_tmpl_id : (tmpl?.id ?? null),
      _template_name: tmpl?.name ?? "\u2014",
      uom_id: typeof r.uom_id === "number" ? r.uom_id : (unit?.unit_id ?? null),
      _uom_name: unit?.unit_name ?? unit?.unit_shortcut ?? null,
      valueIds,
    };
    return NextResponse.json({ ok: true, data: resolved });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown error";
    console.error("[items/variants route]", err);
    return NextResponse.json({ ok: false, message: "BFF Error", detail }, { status: 502 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = UpdateVariantSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, message: "Validation error", errors: parsed.error.issues },
        { status: 400 }
      );
    }
    const { item_tmpl_id, name, uom_id, list_price, sku, active, valueIds } = parsed.data;
    const trimmedName = name?.trim();

    if (trimmedName !== undefined || item_tmpl_id !== undefined || uom_id !== undefined || valueIds !== undefined) {
      const curRes = await fetch(`${DIRECTUS_URL}/items/item_variant/${id}?fields=item_tmpl_id,name,uom_id`, {
        headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
        cache: "no-store",
      });
      if (curRes.ok) {
        const curJson = await curRes.json();
        const cur = (curJson.data || {}) as { item_tmpl_id?: number; name?: string; uom_id?: number | null };
        const effTmplId = item_tmpl_id ?? cur.item_tmpl_id ?? null;
        const effUomId = uom_id !== undefined ? (uom_id ?? null) : (cur.uom_id ?? null);
        const effNameKey = (trimmedName ?? cur.name ?? "").trim().toLowerCase();
        const effCombo = sortedCombo(
          valueIds ?? (await resolveVariantValueIds(Number(id)).catch(() => []))
        );

        if (effTmplId != null) {
          const sibParams = new URLSearchParams({
            fields: "id,name,uom_id",
            limit: "-1",
            filter: JSON.stringify({ item_tmpl_id: { _eq: effTmplId } }),
          });
          const sibRes = await fetch(`${DIRECTUS_URL}/items/item_variant?${sibParams.toString()}`, {
            headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
            cache: "no-store",
          });
          if (sibRes.ok) {
            const sibJson = await sibRes.json();
            const siblings = (sibJson.data || []) as { id: number; name?: unknown; uom_id?: unknown }[];
            for (const sib of siblings) {
              if (sib.id === Number(id)) continue;
              if (resolveUomId(sib.uom_id) !== effUomId) continue;
              if (typeof sib.name === "string" && sib.name.trim().toLowerCase() === effNameKey) {
                return NextResponse.json(
                  { ok: false, message: "A variant with this name and UOM already exists" },
                  { status: 409 }
                );
              }
              const sibCombo = sortedCombo(await resolveVariantValueIds(sib.id).catch(() => []));
              if (sameCombo(sibCombo, effCombo)) {
                return NextResponse.json(
                  { ok: false, message: "A variant with this attribute combination and UOM already exists" },
                  { status: 409 }
                );
              }
            }
          }
        }
      }
    }

    const payload: Record<string, unknown> = {};
    if (item_tmpl_id !== undefined) payload.item_tmpl_id = item_tmpl_id;
    if (trimmedName) payload.name = trimmedName;
    if (uom_id !== undefined) payload.uom_id = uom_id;
    if (list_price !== undefined) payload.list_price = list_price;
    if (sku !== undefined) payload.sku = sku?.trim() ?? null;
    if (active !== undefined) payload.active = active ? 1 : 0;

    const res = await fetch(`${DIRECTUS_URL}/items/item_variant/${id}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${DIRECTUS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(await res.text());
    const json = await res.json();

    // Sync attribute-value relations if provided
    if (Array.isArray(valueIds) && Number(id) > 0) {
      const variantId = Number(id);

      // Get existing relations
      const relParams = new URLSearchParams({
        "filter[item_variant_id][_eq]": String(variantId),
        fields: "id,item_attribute_value_id",
      });
      const relRes = await fetch(
        `${DIRECTUS_URL}/items/item_attribute_value_item_variant_rel?${relParams.toString()}`,
        { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` }, cache: "no-store" }
      );
      let existingRels: Record<string, unknown>[] = [];
      if (relRes.ok) {
        const relJson = await relRes.json();
        existingRels = (relJson.data || []) as Record<string, unknown>[];
      }

      const existingValueIds = new Set(
        existingRels.map((r) => r.item_attribute_value_id as number)
      );
      const newValueIds = new Set(valueIds.filter((v: unknown) => typeof v === "number"));

      // Delete removed relations
      for (const rel of existingRels) {
        if (!newValueIds.has(rel.item_attribute_value_id as number)) {
          await fetch(
            `${DIRECTUS_URL}/items/item_attribute_value_item_variant_rel/${rel.id}`,
            { method: "DELETE", headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` }, cache: "no-store" }
          ).catch(() => {});
        }
      }

      // Create new relations
      for (const valueId of newValueIds) {
        if (!existingValueIds.has(valueId)) {
          await fetch(`${DIRECTUS_URL}/items/item_attribute_value_item_variant_rel`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${DIRECTUS_TOKEN}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ item_variant_id: variantId, item_attribute_value_id: valueId }),
            cache: "no-store",
          }).catch(() => {});
        }
      }
    }

    return NextResponse.json({ ok: true, data: json.data });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown error";
    console.error("[items/variants route]", err);
    return NextResponse.json({ ok: false, message: "BFF Error", detail }, { status: 502 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const curRes = await fetch(`${DIRECTUS_URL}/items/item_variant/${id}?fields=id,item_tmpl_id`, {
      headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
      cache: "no-store",
    });
    if (curRes.status === 404) {
      return NextResponse.json({ ok: false, message: "Variant not found" }, { status: 404 });
    }
    if (curRes.ok) {
      const curJson = await curRes.json();
      const tmplId = (curJson.data as { item_tmpl_id?: number })?.item_tmpl_id;
      if (typeof tmplId === "number") {
        const countParams = new URLSearchParams({
          fields: "id",
          limit: "-1",
          meta: "total_count",
          filter: JSON.stringify({ item_tmpl_id: { _eq: tmplId } }),
        });
        const countRes = await fetch(`${DIRECTUS_URL}/items/item_variant?${countParams.toString()}`, {
          headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
          cache: "no-store",
        });
        if (countRes.ok) {
          const countJson = await countRes.json();
          const total: number = countJson.meta?.total_count ?? (countJson.data || []).length;
          if (total <= 1) {
            return NextResponse.json(
              { ok: false, message: "Each item needs at least one variant" },
              { status: 400 }
            );
          }
        }
      }
    }
    const res = await fetch(`${DIRECTUS_URL}/items/item_variant/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
      cache: "no-store",
    });
    if (res.status === 404) {
      return NextResponse.json({ ok: false, message: "Variant not found" }, { status: 404 });
    }
    if (!res.ok) throw new Error(await res.text());
    return NextResponse.json({ ok: true, data: { id: Number(id) } });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown error";
    console.error("[items/variants route]", err);
    return NextResponse.json({ ok: false, message: "BFF Error", detail }, { status: 502 });
  }
}
