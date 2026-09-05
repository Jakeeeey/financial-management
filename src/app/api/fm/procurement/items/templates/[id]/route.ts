import { NextRequest, NextResponse } from "next/server";
import { UpdateItemSchema } from "@/modules/financial-management/procurement/items/utils/schemas";

export const runtime = "nodejs";
const DIRECTUS_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN || "";

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
    return NextResponse.json({ ok: true, data: json.data });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown error";
    console.error("[items/templates route]", err);
    return NextResponse.json({ ok: false, message: "BFF Error", detail }, { status: 502 });
  }
}
