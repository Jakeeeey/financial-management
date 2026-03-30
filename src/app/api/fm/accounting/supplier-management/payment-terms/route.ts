import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const DIRECTUS_BASE = process.env.DIRECTUS_BASE_URL ?? "http://192.168.0.143:8056";
const DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN;
const COOKIE_NAME = "vos_access_token";

function buildHeaders() {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (DIRECTUS_TOKEN) headers["Authorization"] = `Bearer ${DIRECTUS_TOKEN}`;
  return headers;
}

function normalizeTermName(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function decodeJwtPayload(token: string) {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;

    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
    const json = Buffer.from(padded, "base64").toString("utf8");
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function pickString(source: Record<string, unknown> | null | undefined, keys: string[]) {
  for (const key of keys) {
    const value = source?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

type DirectusUser = {
  user_id?: string | number | null;
  user_email?: string | null;
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

async function resolveCurrentUserId() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value ?? null;
  const payload = token ? decodeJwtPayload(token) : null;

  const directId = pickString(payload, ["user_id", "userId"]);
  if (directId) {
    return directId;
  }

  const email = pickString(payload, ["email", "Email"]);
  if (email) {
    try {
      const response = await fetch(
        `${DIRECTUS_BASE}/items/user?fields=user_id,user_email&filter[user_email][_eq]=${encodeURIComponent(email)}`,
        {
          cache: "no-store",
          headers: buildHeaders(),
        },
      );

      if (response.ok) {
        const json = await response.json();
        const user = Array.isArray(json?.data) ? json.data[0] : null;
        const userId = String(user?.user_id ?? "").trim();
        if (userId) {
          return userId;
        }
      }
    } catch {
    }
  }

  return null;
}

async function hasDuplicatePaymentTermName(name: string) {
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

  return items.some((item: { payment_name?: string | null }) => normalizeTermName(item.payment_name) === normalizedName);
}

export async function GET() {
  try {
    const [termsRes, usersRes] = await Promise.all([
      fetch(`${DIRECTUS_BASE}/items/payment_terms`, { cache: "no-store", headers: buildHeaders() }),
      fetch(`${DIRECTUS_BASE}/items/user?fields=user_id,user_fname,user_lname`, { cache: "no-store", headers: buildHeaders() }),
    ]);

    if (!termsRes.ok) {
      const txt = await termsRes.text();
      return NextResponse.json({ error: txt || "Failed to fetch remote data" }, { status: termsRes.status });
    }

    const [termsJson, usersJson] = await Promise.all([
      termsRes.json(),
      usersRes.ok ? usersRes.json() : Promise.resolve({ data: [] }),
    ]);

    const items = termsJson?.data ?? termsJson;
    const users = Array.isArray(usersJson?.data) ? usersJson.data : [];
    const userMap = new Map<string, string>();

    for (const user of users as DirectusUser[]) {
      const displayName = buildUserDisplayName(user);
      for (const key of getUserLookupKeys(user)) {
        userMap.set(key, displayName);
      }
    }

    const { toLocal } = await import("./transform");
    const mapped = Array.isArray(items)
      ? items.map((item) => {
          const term = toLocal(item);
          return {
            ...term,
            createdByName:
              term?.createdByName || (term?.createdBy ? userMap.get(term.createdBy) ?? "-" : "-"),
          };
        })
      : [];

    return NextResponse.json(mapped);
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (await hasDuplicatePaymentTermName(body.name)) {
      return NextResponse.json(
        { error: "Payment term name must be unique." },
        { status: 409 },
      );
    }

    const { toRemote, toLocal } = await import("./transform");
    const createdBy = body.createdBy ? String(body.createdBy) : await resolveCurrentUserId();
    const remoteData = {
      ...toRemote(body),
      ...(createdBy ? { created_by: createdBy } : {}),
    };

    const res = await fetch(`${DIRECTUS_BASE}/items/payment_terms`, {
      method: "POST",
      headers: buildHeaders(),
      // Directus REST expects the fields at the top-level of the JSON body
      body: JSON.stringify(remoteData),
    });

    if (!res.ok) {
      const txt = await res.text();
      console.error("Directus POST error:", res.status, txt);
      return NextResponse.json({ error: txt || "Failed to create remote item" }, { status: res.status });
    }

    const json = await res.json();
    const created = json?.data ?? json;
    const mapped = toLocal(created);
    return NextResponse.json(mapped, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create payment term" },
      { status: 500 },
    );
  }
}
