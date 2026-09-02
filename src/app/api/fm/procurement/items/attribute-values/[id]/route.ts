import { NextRequest, NextResponse } from "next/server";
import { UpdateAttributeValueSchema } from "@/modules/financial-management/procurement/items/utils/schemas";

export const runtime = "nodejs";
const DIRECTUS_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN || "";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const res = await fetch(`${DIRECTUS_URL}/items/item_attribute_value/${id}`, {
      headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
      cache: "no-store",
    });
    if (res.status === 404) {
      return NextResponse.json({ ok: false, message: "Attribute value not found" }, { status: 404 });
    }
    if (!res.ok) throw new Error(await res.text());
    const json = await res.json();
    return NextResponse.json({ ok: true, data: json.data });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown error";
    console.error("[items/attribute-values route]", err);
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
    const parsed = UpdateAttributeValueSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, message: "Validation error", errors: parsed.error.issues },
        { status: 400 }
      );
    }

    const res = await fetch(`${DIRECTUS_URL}/items/item_attribute_value/${id}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${DIRECTUS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: parsed.data.name.trim() }),
      cache: "no-store",
    });
    if (res.status === 404) {
      return NextResponse.json({ ok: false, message: "Attribute value not found" }, { status: 404 });
    }
    if (!res.ok) throw new Error(await res.text());
    const json = await res.json();
    return NextResponse.json({ ok: true, data: json.data });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown error";
    console.error("[items/attribute-values route]", err);
    return NextResponse.json({ ok: false, message: "BFF Error", detail }, { status: 502 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const res = await fetch(`${DIRECTUS_URL}/items/item_attribute_value/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
      cache: "no-store",
    });
    if (res.status === 404) {
      return NextResponse.json({ ok: false, message: "Attribute value not found" }, { status: 404 });
    }
    if (!res.ok) {
      const detail = await res.text();
      console.error("[items/attribute-values route] DELETE blocked by FK constraint", detail);
      return NextResponse.json(
        { ok: false, message: "Cannot delete value used by variants", detail },
        { status: 409 }
      );
    }
    return NextResponse.json({ ok: true, data: { id: Number(id) } });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown error";
    console.error("[items/attribute-values route]", err);
    return NextResponse.json({ ok: false, message: "BFF Error", detail }, { status: 502 });
  }
}
