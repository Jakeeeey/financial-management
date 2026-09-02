import { NextRequest, NextResponse } from "next/server";
import { CreateVariantSchema } from "@/modules/financial-management/procurement/items/utils/schemas";

export const runtime = "nodejs";
const DIRECTUS_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN || "";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(300, Math.max(1, Number(searchParams.get("limit")) || 50));
    const offset = (page - 1) * limit;

    const activeOnly = searchParams.get("active_only") === "true";
    const itemTmplIdRaw = searchParams.get("item_tmpl_id");

    const filter: Record<string, unknown> = {};
    const andConditions: Record<string, unknown>[] = [];

    if (activeOnly) {
      andConditions.push({ active: { _eq: true } });
    }

    if (itemTmplIdRaw) {
      const itemTmplId = Number(itemTmplIdRaw);
      if (Number.isInteger(itemTmplId) && itemTmplId > 0) {
        andConditions.push({ item_tmpl_id: { _eq: itemTmplId } });
      }
    }

    if (search) {
      andConditions.push({ name: { _icontains: search } });
    }

    if (andConditions.length === 1) {
      Object.assign(filter, andConditions[0]);
    } else if (andConditions.length > 1) {
      filter._and = andConditions;
    }

    const params = new URLSearchParams({
      fields: "*,item_tmpl_id.id,item_tmpl_id.name,uom_id.unit_id,uom_id.unit_name,uom_id.unit_shortcut",
      sort: "-created_at",
      limit: String(limit),
      offset: String(offset),
      meta: "total_count",
    });
    if (Object.keys(filter).length) {
      params.set("filter", JSON.stringify(filter));
    }

    const res = await fetch(`${DIRECTUS_URL}/items/item_variant?${params.toString()}`, {
      headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(await res.text());
    const json = await res.json();

    const rows: Record<string, unknown>[] = (json.data || []).map(
      (r: Record<string, unknown>) => {
        const tmpl = r.item_tmpl_id as Record<string, unknown> | null;
        const unit = r.uom_id as Record<string, unknown> | null;
        return {
          ...r,
          item_tmpl_id: typeof r.item_tmpl_id === "number" ? r.item_tmpl_id : (tmpl?.id ?? null),
          _template_name: tmpl?.name ?? "\u2014",
          uom_id: typeof r.uom_id === "number" ? r.uom_id : (unit?.unit_id ?? null),
          _uom_name: unit?.unit_name ?? unit?.unit_shortcut ?? null,
        };
      }
    );

    return NextResponse.json({
      ok: true,
      data: rows,
      total: json.meta?.total_count ?? rows.length,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown error";
    console.error("[items/variants route]", err);
    return NextResponse.json({ ok: false, message: "BFF Error", detail }, { status: 502 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = CreateVariantSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, message: "Validation error", errors: parsed.error.issues },
        { status: 400 }
      );
    }
    const { item_tmpl_id, name, uom_id, list_price, sku, valueIds } = parsed.data;

    const payload: Record<string, unknown> = {
      item_tmpl_id,
      name: name.trim(),
      active: true,
    };
    if (uom_id !== undefined) payload.uom_id = uom_id;
    if (list_price != null) payload.list_price = list_price;
    if (sku?.trim()) payload.sku = sku.trim();

    const res = await fetch(`${DIRECTUS_URL}/items/item_variant`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${DIRECTUS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    const variantId: number = data.data?.id;

    // Process attribute value IDs → junction tables
    if (Array.isArray(valueIds) && valueIds.length > 0 && typeof variantId === "number") {
      // Skipped dead junction table writes (template_line/template_value): write-only, never read.
      console.warn(
        "[items/variants route] Skipped dead junction table writes (template_line/template_value)"
      );

      for (const valueId of valueIds) {
        // Create the variant → attribute value relation
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

    return NextResponse.json({ ok: true, data: data.data }, { status: 201 });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown error";
    console.error("[items/variants route]", err);
    return NextResponse.json({ ok: false, message: "BFF Error", detail }, { status: 502 });
  }
}
