import { NextRequest, NextResponse } from "next/server";
import { toLocal, type PaymentTermSource } from "../transform";

const DIRECTUS_BASE = process.env.DIRECTUS_BASE_URL;
const DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN;

function buildHeaders() {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (DIRECTUS_TOKEN) headers["Authorization"] = `Bearer ${DIRECTUS_TOKEN}`;
  return headers;
}

type DirectusUser = {
  user_id?: string | number | null;
  user_fname?: string | null;
  user_lname?: string | null;
};

function buildUserDisplayName(user: DirectusUser) {
  const firstName = String(user.user_fname ?? "").trim();
  const lastName = String(user.user_lname ?? "").trim();
  const fullName = `${firstName} ${lastName}`.trim();
  return fullName || "-";
}

function getUserLookupKeys(user: DirectusUser) {
  return [user.user_id]
    .filter((value): value is string | number => value !== null && value !== undefined && value !== "")
    .map((value) => String(value));
}

async function resolveCreatedByName(createdBy: string | null | undefined) {
  if (!createdBy) return "-";

  const res = await fetch(`${DIRECTUS_BASE}/items/user?fields=user_id,user_fname,user_lname`, {
    cache: "no-store",
    headers: buildHeaders(),
  });

  if (!res.ok) return "-";

  const json = await res.json();
  const users = Array.isArray(json?.data) ? json.data : [];
  const userMap = new Map<string, string>();

  for (const user of users as DirectusUser[]) {
    const displayName = buildUserDisplayName(user);
    for (const key of getUserLookupKeys(user)) {
      userMap.set(key, displayName);
    }
  }

  return userMap.get(createdBy) ?? "-";
}

function normalizeTermName(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

async function hasDuplicatePaymentTermName(name: string, excludeId: string) {
  const normalizedName = normalizeTermName(name);
  if (!normalizedName) return false;

  const res = await fetch(`${DIRECTUS_BASE}/items/payment_terms?fields=id,payment_name`, {
    cache: "no-store",
    headers: buildHeaders(),
  });

  if (!res.ok) {
    throw new Error("Failed to validate payment term name uniqueness");
  }

  const json = await res.json();
  const items = Array.isArray(json?.data) ? json.data : [];

  return items.some(
    (item: { id?: string | number; payment_name?: string | null }) =>
      String(item.id ?? "") !== excludeId && normalizeTermName(item.payment_name) === normalizedName,
  );
}

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const res = await fetch(`${DIRECTUS_BASE}/items/payment_terms/${encodeURIComponent(id)}`, { cache: "no-store", headers: buildHeaders() });
    if (!res.ok) {
      const txt = await res.text();
      return NextResponse.json({ success: false, error: txt || "Not found" }, { status: res.status });
    }
    const json = await res.json();
    const term = (json?.data ?? json) as PaymentTermSource | null | undefined;
    const mapped = toLocal(term);
    return NextResponse.json({
      success: true,
      data: {
        ...mapped,
        createdByName: mapped?.createdByName || (await resolveCreatedByName(mapped?.createdBy)),
      },
    });
  } catch (error: unknown) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    if (await hasDuplicatePaymentTermName(body.name, id)) {
      return NextResponse.json(
        { success: false, error: "Payment term name must be unique." },
        { status: 409 },
      );
    }

    const { toRemote, toLocal } = await import("../transform");
    const remoteData = toRemote(body);

    const res = await fetch(`${DIRECTUS_BASE}/items/payment_terms/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: buildHeaders(),
      // Directus REST PATCH expects the fields at the top-level of the JSON body
      body: JSON.stringify(remoteData),
    });

    if (!res.ok) {
      const txt = await res.text();
      console.error("Directus PATCH error:", res.status, txt);
      return NextResponse.json({ success: false, error: txt || "Failed to update" }, { status: res.status });
    }

    const json = await res.json();
    const updated = json?.data ?? json;
    const mapped = toLocal(updated);
    return NextResponse.json({
      success: true,
      data: {
        ...mapped,
        createdByName: mapped?.createdByName || (await resolveCreatedByName(mapped?.createdBy)),
      },
      message: "Payment term updated",
    });
  } catch (error: unknown) {
    console.error("PATCH Payment Term Error:", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Failed to update" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const res = await fetch(`${DIRECTUS_BASE}/items/payment_terms/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: buildHeaders(),
    });
    if (!res.ok) {
      const txt = await res.text();
      return NextResponse.json({ success: false, error: txt || "Failed to delete" }, { status: res.status });
    }
    return NextResponse.json({ success: true, message: "Deleted" });
  } catch (error: unknown) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Failed to delete" }, { status: 500 });
  }
}
