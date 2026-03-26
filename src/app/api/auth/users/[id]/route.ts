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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    console.log(`🔄 /api/auth/users/${id} - Fetching user`);

    if (!id) {
      console.warn("❌ /api/auth/users - No ID provided");
      return json({ error: "Missing user ID" }, { status: 400 });
    }

    const res = await directusFetch(
      `/items/user/${encodeURIComponent(id)}?fields=user_id,user_fname,user_lname,user_email`
    );

    console.log(`📡 /api/auth/users/${id} - Directus response status:`, res.status);

    if (!res.ok) {
      console.warn(`❌ /api/auth/users/${id} - Directus returned error:`, res.json);
      return json(res.json, { status: res.status });
    }

    const userData = (res.json as Record<string, unknown>)?.data as
      | Record<string, unknown>
      | undefined;

    console.log(`📊 /api/auth/users/${id} - User data:`, userData);

    if (!userData) {
      console.warn(`❌ /api/auth/users/${id} - User not found`);
      return json({ error: "User not found" }, { status: 404 });
    }

    const response = {
      id: userData.user_id,
      user_fname: userData.user_fname,
      user_lname: userData.user_lname,
      user_email: userData.user_email,
    };

    console.log(`✅ /api/auth/users/${id} - Returning:`, response);

    return json(response);
  } catch (e: unknown) {
    console.error(`❌ /api/auth/users error:`, e);
    return json(
      {
        error: "Server error",
        message: String(e instanceof Error ? e.message : e),
      },
      { status: 500 }
    );
  }
}
