import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
const DIRECTUS_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN || "";

const VALUE_NEW_COLUMNS = ["description", "is_active", "created_by", "updated_by", "updated_at"];

function mentionsMissingColumn(detail: string): boolean {
  const lower = detail.toLowerCase();
  return (
    lower.includes("unknown column") ||
    VALUE_NEW_COLUMNS.some((c) => lower.includes(`\`${c}\``) || lower.includes(`"${c}"`) || lower.includes(`'${c}'`) || lower.includes(c))
  );
}

async function postDirectus(payload: Record<string, unknown>): Promise<Response> {
  return fetch(`${DIRECTUS_URL}/items/item_attribute_value`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${DIRECTUS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { attribute_id, name, description, extra_price, is_active } = body;

    if (!attribute_id) {
      return NextResponse.json({ ok: false, message: "Attribute ID is required" }, { status: 400 });
    }
    if (!name?.trim()) {
      return NextResponse.json({ ok: false, message: "Value name is required" }, { status: 400 });
    }

    const legacyPayload: Record<string, unknown> = {
      attribute_id: Number(attribute_id),
      name: name.trim(),
      extra_price: extra_price != null ? Number(extra_price) : 0,
    };
    const fullPayload: Record<string, unknown> = { ...legacyPayload };
    if (description !== undefined) fullPayload.description = description;
    if (is_active !== undefined) fullPayload.is_active = Boolean(is_active);

    let res = await postDirectus(fullPayload);
    let degraded = false;
    if (!res.ok && Object.keys(fullPayload).length > Object.keys(legacyPayload).length) {
      const detail = await res.text();
      if (mentionsMissingColumn(detail)) {
        res = await postDirectus(legacyPayload);
        degraded = res.ok;
      } else {
        throw new Error(detail);
      }
    }
    if (!res.ok) throw new Error(await res.text());
    const json = await res.json();

    return NextResponse.json({ ok: true, data: json.data, ...(degraded ? { degraded: true } : {}) }, { status: 201 });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown error";
    console.error("[items/attribute-values route]", err);
    return NextResponse.json({ ok: false, message: "BFF Error", detail }, { status: 502 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const rawLimit = searchParams.get("limit");
    const limit = rawLimit === "-1" || !rawLimit ? -1 : Math.min(300, Math.max(1, Number(rawLimit) || 50));
    const offset = limit === -1 ? 0 : (page - 1) * limit;

    const params = new URLSearchParams({
      sort: "name",
      limit: String(limit),
      offset: String(offset),
      meta: "total_count",
    });

    const res = await fetch(`${DIRECTUS_URL}/items/item_attribute_value?${params.toString()}`, {
      headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(await res.text());
    const json = await res.json();
    const rows: unknown[] = json.data || [];
    return NextResponse.json({
      ok: true,
      data: rows,
      total: json.meta?.total_count ?? rows.length,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown error";
    console.error("[items/attribute-values route]", err);
    return NextResponse.json({ ok: false, message: "BFF Error", detail }, { status: 502 });
  }
}
