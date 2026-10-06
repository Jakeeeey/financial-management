import { NextRequest, NextResponse } from "next/server";
import { UpdateItemSchema } from "@/modules/financial-management/procurement/items/utils/schemas";

export const runtime = "nodejs";
const DIRECTUS_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN || "";

function resolveUomId(raw: unknown): number | null {
  if (typeof raw === "number") return raw;
  if (raw && typeof raw === "object") {
    const unitId = (raw as Record<string, unknown>).unit_id;
    if (typeof unitId === "number") return unitId;
  }
  return null;
}

// Rel-table insertion order (sort=id): variant's attribute value ids.
async function resolveVariantValueIds(variantId: number): Promise<number[]> {
  const relParams = new URLSearchParams({
    "filter[item_variant_id][_eq]": String(variantId),
    fields: "item_attribute_value_id",
    sort: "id",
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

async function resolveValueNames(valueIds: number[]): Promise<Map<number, string>> {
  const names = new Map<number, string>();
  const unique = [...new Set(valueIds.filter((v) => v > 0))];
  if (!unique.length) return names;
  const valParams = new URLSearchParams({
    fields: "id,name",
    limit: "-1",
    filter: JSON.stringify({ id: { _in: unique } }),
  });
  const valRes = await fetch(`${DIRECTUS_URL}/items/item_attribute_value?${valParams.toString()}`, {
    headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
    cache: "no-store",
  });
  if (!valRes.ok) return names;
  const valJson = await valRes.json();
  for (const row of (valJson.data || []) as { id: number; name?: unknown }[]) {
    if (typeof row.name === "string") names.set(row.id, row.name);
  }
  return names;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const res = await fetch(`${DIRECTUS_URL}/items/item_template/${id}?fields=*`, {
      headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(await res.text());
    const json = await res.json();

    return NextResponse.json({
      ok: true,
      data: json.data,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown error";
    console.error("[items/templates route]", err);
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
    const parsed = UpdateItemSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, message: "Validation error", errors: parsed.error.issues },
        { status: 400 }
      );
    }
    const { name, description, is_active } = parsed.data;
    const trimmedName = name?.trim();

    if (trimmedName) {
      const dupParams = new URLSearchParams({
        fields: "id,name",
        limit: "-1",
        filter: JSON.stringify({ name: { _icontains: trimmedName } }),
      });
      const dupRes = await fetch(`${DIRECTUS_URL}/items/item_template?${dupParams.toString()}`, {
        headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
        cache: "no-store",
      });
      if (dupRes.ok) {
        const dupJson = await dupRes.json();
        const existing = (dupJson.data || []) as { id: number; name: string }[];
        if (existing.some((t) => t.id !== Number(id) && t.name.toLowerCase() === trimmedName.toLowerCase())) {
          return NextResponse.json({ ok: false, message: "An item with this name already exists" }, { status: 409 });
        }
      }
    }

    const payload: Record<string, unknown> = {};
    if (trimmedName) payload.name = trimmedName;
    if (description !== undefined) payload.description = description?.trim() ?? null;
    if (is_active !== undefined) payload.is_active = is_active ? 1 : 0;

    let oldTemplateName: string | null = null;
    if (trimmedName) {
      const curRes = await fetch(`${DIRECTUS_URL}/items/item_template/${id}?fields=name`, {
        headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
        cache: "no-store",
      });
      if (curRes.ok) {
        const curJson = await curRes.json();
        const curName = (curJson.data || {}).name;
        oldTemplateName = typeof curName === "string" ? curName : null;
      }
    }

    const res = await fetch(`${DIRECTUS_URL}/items/item_template/${id}`, {
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

    let cascaded = 0;
    let skipped = 0;
    if (trimmedName && oldTemplateName && oldTemplateName !== trimmedName) {
      try {
        const varParams = new URLSearchParams({
          fields: "id,name,uom_id",
          limit: "-1",
          filter: JSON.stringify({ item_tmpl_id: { _eq: Number(id) } }),
        });
        const varRes = await fetch(`${DIRECTUS_URL}/items/item_variant?${varParams.toString()}`, {
          headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
          cache: "no-store",
        });
        if (varRes.ok) {
          const varJson = await varRes.json();
          const allVariants = (varJson.data || []) as { id: number; name?: unknown; uom_id?: unknown }[];
          const prefixed = allVariants.filter(
            (v) => typeof v.name === "string" && v.name.startsWith(oldTemplateName as string)
          );
          const relValueIds = new Map<number, number[]>();
          const allValueIds: number[] = [];
          for (const v of prefixed) {
            const ids = await resolveVariantValueIds(v.id).catch(() => [] as number[]);
            relValueIds.set(v.id, ids);
            allValueIds.push(...ids);
          }
          const nameById = await resolveValueNames(allValueIds);
          const claimed = new Set<string>();
          for (const v of prefixed) {
            const valueNames = (relValueIds.get(v.id) || [])
              .map((vid) => nameById.get(vid))
              .filter(Boolean) as string[];
            const newVariantName = [trimmedName, ...valueNames].filter(Boolean).join(" ").trim();
            if (!newVariantName || newVariantName === v.name) continue;
            const newKey = `${newVariantName.toLowerCase()}__${resolveUomId(v.uom_id) ?? "null"}`;
            let conflict = claimed.has(newKey);
            if (!conflict) {
              for (const sib of allVariants) {
                if (sib.id === v.id) continue;
                if (resolveUomId(sib.uom_id) !== resolveUomId(v.uom_id)) continue;
                if (typeof sib.name === "string" && sib.name.trim().toLowerCase() === newVariantName.toLowerCase()) {
                  conflict = true;
                  break;
                }
              }
            }
            if (conflict) {
              skipped += 1;
              continue;
            }
            const patchRes = await fetch(`${DIRECTUS_URL}/items/item_variant/${v.id}`, {
              method: "PATCH",
              headers: {
                Authorization: `Bearer ${DIRECTUS_TOKEN}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ name: newVariantName }),
              cache: "no-store",
            });
            if (patchRes.ok) {
              claimed.add(newKey);
              cascaded += 1;
            } else {
              skipped += 1;
            }
          }
        }
      } catch (cascadeErr) {
        console.error("[items/templates route] cascade rename", cascadeErr);
      }
    }
    return NextResponse.json({ ok: true, data: json.data, cascaded, skipped });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown error";
    console.error("[items/templates route]", err);
    return NextResponse.json({ ok: false, message: "BFF Error", detail }, { status: 502 });
  }
}
