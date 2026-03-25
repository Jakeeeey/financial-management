// src/app/api/fm/accounting/supplier-management/delivery-terms/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const DIRECTUS_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") || "";

const STATIC_TOKEN = process.env.DIRECTUS_STATIC_TOKEN || "";

function json(resBody: unknown, init?: ResponseInit) {
  return NextResponse.json(resBody, init);
}

function authHeaders() {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  // Static token (service token)
  if (STATIC_TOKEN) headers.Authorization = `Bearer ${STATIC_TOKEN}`;

  return headers;
}

async function directusFetch(path: string, init?: RequestInit) {
  if (!DIRECTUS_BASE) {
    return {
      ok: false,
      status: 500,
      json: { error: "NEXT_PUBLIC_API_BASE_URL is not set" },
    };
  }

  const url = `${DIRECTUS_BASE}${path.startsWith("/") ? "" : "/"}${path}`;

  const res = await fetch(url, {
    cache: "no-store",
    ...init,
    headers: {
      ...authHeaders(),
      ...(init?.headers || {}),
    },
  });

  let data: unknown = null;
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) data = await res.json();
  else data = await res.text();

  return { ok: res.ok, status: res.status, json: data };
}

/**
 * Build Directus query for Delivery Terms list:
 * - search by delivery_name or delivery_description
 * - pagination by page/pageSize
 * - meta for total count
 */
function buildDeliveryTermsListQuery(req: NextRequest) {
  const sp = req.nextUrl.searchParams;

  const q = (sp.get("q") || "").trim();
  const page = Math.max(1, Number(sp.get("page") || "1") || 1);
  const pageSize = Math.min(100, Math.max(1, Number(sp.get("pageSize") || "20") || 20));

  const offset = (page - 1) * pageSize;

  const params = new URLSearchParams();
  params.set("limit", String(pageSize));
  params.set("offset", String(offset));
  params.set("sort", "-updated_at");
  params.set("meta", "filter_count,total_count");

  params.set(
    "fields",
    [
      "id",
      "delivery_name",
      "delivery_description",
      "created_by",
      "created_at",
      "updated_by",
      "updated_at",
    ].join(",")
  );

  if (q) {
    // Directus OR filter
    params.set("filter[_or][0][delivery_name][_icontains]", q);
    params.set("filter[_or][1][delivery_description][_icontains]", q);
  }

  return { q, page, pageSize, offset, params };
}

export async function GET(req: NextRequest) {
  try {
    const { params, page, pageSize } = buildDeliveryTermsListQuery(req);
    const res = await directusFetch(`/items/delivery_terms?${params.toString()}`);
    if (!res.ok) return json(res.json, { status: res.status });

    // add paging echo for convenience
    const payload = (res.json as Record<string, unknown>) || {};
    return json({
      ...payload,
      paging: { page, pageSize },
    });
  } catch (e: unknown) {
    return json(
      { error: "Server error", message: String(e instanceof Error ? e.message : e) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    console.log("📥 POST /delivery-terms - Received body:", body);

    // Get the max ID, then generate the next one
    const maxRes = await directusFetch(`/items/delivery_terms?fields=id&sort=-id&limit=1`);
    const maxIdData = (maxRes.json as Record<string, unknown>)?.data as Array<Record<string, unknown>> | undefined;
    const currentMaxId = maxIdData?.[0]?.id as number | undefined;
    const nextId = (currentMaxId ? Number(currentMaxId) : 0) + 1;

    // Add the generated ID to the payload
    const payloadWithId = {
      ...body,
      id: nextId,
    };

    console.log("📤 Sending to Directus:", payloadWithId);

    const res = await directusFetch(`/items/delivery_terms`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payloadWithId),
    });
    
    console.log("📡 Directus response status:", res.status);
    console.log("📡 Directus response:", res.json);
    
    if (!res.ok) return json(res.json, { status: res.status });
    return json(res.json);
  } catch (e: unknown) {
    console.error("❌ POST error:", e);
    return json(
      { error: "Server error", message: String(e instanceof Error ? e.message : e) },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;

    const id = String((body as Record<string, unknown>)?.id ?? "").trim();
    const payload = body?.payload ?? null;

    if (!id || !payload) {
      return json(
        { error: "Bad request", message: "Missing id or payload" },
        { status: 400 }
      );
    }

    const res = await directusFetch(`/items/delivery_terms/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) return json(res.json, { status: res.status });
    return json(res.json);
  } catch (e: unknown) {
    return json(
      { error: "Server error", message: String(e instanceof Error ? e.message : e) },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const id = (sp.get("id") || "").trim();

    if (!id) {
      return json({ error: "Bad request", message: "Missing id" }, { status: 400 });
    }

    const res = await directusFetch(`/items/delivery_terms/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });

    // Directus often returns 204 No Content
    if (!res.ok && res.status !== 204) return json(res.json, { status: res.status });

    return json({ ok: true });
  } catch (e: unknown) {
    return json(
      { error: "Server error", message: String(e instanceof Error ? e.message : e) },
      { status: 500 }
    );
  }
}
