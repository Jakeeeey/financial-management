import { NextRequest, NextResponse } from "next/server";
import { UpdateAttributeSchema } from "@/modules/financial-management/procurement/items/utils/schemas";

export const runtime = "nodejs";
const DIRECTUS_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN || "";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const res = await fetch(`${DIRECTUS_URL}/items/item_attribute/${id}`, {
      headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
      cache: "no-store",
    });
    if (res.status === 404) {
      return NextResponse.json({ ok: false, message: "Attribute not found" }, { status: 404 });
    }
    if (!res.ok) throw new Error(await res.text());
    const json = await res.json();
    return NextResponse.json({ ok: true, data: json.data });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown error";
    console.error("[items/attributes route]", err);
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
    const parsed = UpdateAttributeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, message: "Validation error", errors: parsed.error.issues },
        { status: 400 }
      );
    }

    const patchPayload: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) patchPayload.name = parsed.data.name.trim();
    if (parsed.data.description !== undefined) patchPayload.description = parsed.data.description;
    if (parsed.data.is_active !== undefined) patchPayload.is_active = parsed.data.is_active;

    async function patchDirectus(payload: Record<string, unknown>): Promise<Response> {
      return fetch(`${DIRECTUS_URL}/items/item_attribute/${id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${DIRECTUS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        cache: "no-store",
      });
    }

    let res = await patchDirectus(patchPayload);
    let degraded = false;
    if (res.status === 404) {
      return NextResponse.json({ ok: false, message: "Attribute not found" }, { status: 404 });
    }
    if (!res.ok && "name" in patchPayload && Object.keys(patchPayload).length > 1) {
      const detail = await res.text();
      if (detail.toLowerCase().includes("unknown column")) {
        res = await patchDirectus({ name: patchPayload.name });
        degraded = res.ok;
        if (res.status === 404) {
          return NextResponse.json({ ok: false, message: "Attribute not found" }, { status: 404 });
        }
      } else {
        throw new Error(detail);
      }
    }
    if (!res.ok) throw new Error(await res.text());
    const json = await res.json();
    return NextResponse.json({ ok: true, data: json.data, ...(degraded ? { degraded: true } : {}) });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown error";
    console.error("[items/attributes route]", err);
    return NextResponse.json({ ok: false, message: "BFF Error", detail }, { status: 502 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const res = await fetch(`${DIRECTUS_URL}/items/item_attribute/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
      cache: "no-store",
    });
    if (res.status === 404) {
      return NextResponse.json({ ok: false, message: "Attribute not found" }, { status: 404 });
    }
    if (!res.ok) {
      const detail = await res.text();
      console.error("[items/attributes route] DELETE blocked by FK constraint", detail);
      return NextResponse.json(
        { ok: false, message: "Cannot delete attribute used by variants", detail },
        { status: 409 }
      );
    }
    return NextResponse.json({ ok: true, data: { id: Number(id) } });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown error";
    console.error("[items/attributes route]", err);
    return NextResponse.json({ ok: false, message: "BFF Error", detail }, { status: 502 });
  }
}
