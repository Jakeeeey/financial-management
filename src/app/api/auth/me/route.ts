// src/app/api/auth/me/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const COOKIE_NAME = "vos_access_token";
const DIRECTUS_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") || "";
const STATIC_TOKEN = process.env.DIRECTUS_STATIC_TOKEN || "";

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    console.log("🔐 decodeJwtPayload: Decoding token...");
    const parts = token.split(".");
    console.log("🔐 decodeJwtPayload: Token has", parts.length, "parts");
    
    if (parts.length < 2) {
      console.warn("⚠️  decodeJwtPayload: Invalid token format");
      return null;
    }

    const p = parts[1];
    const b64 = p.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);

    const json = Buffer.from(padded, "base64").toString("utf8");
    const parsed = JSON.parse(json) as Record<string, unknown>;
    
    console.log("✅ decodeJwtPayload: Successfully decoded payload:", parsed);
    return parsed;
  } catch (e) {
    console.error("❌ decodeJwtPayload: Error decoding:", e);
    return null;
  }
}

function extractUserId(payload: Record<string, unknown> | null): number | null {
  if (!payload) {
    console.warn("⚠️  extractUserId: payload is null");
    return null;
  }

  console.log("🔍 extractUserId: Full JWT Payload:", JSON.stringify(payload, null, 2));
  console.log("🔍 extractUserId: Payload keys:", Object.keys(payload));
  console.log("🔍 extractUserId: Payload entries:", Object.entries(payload));

  // Try each possible field name in order
  const possibleFields = ["user_id", "id", "userId", "sub", "uid", "pk", "user", "auth_id"];
  
  for (const field of possibleFields) {
    const value = payload[field];
    console.log(`🔍 extractUserId: Checking field "${field}":`, value, "type:", typeof value);
    
    if (typeof value === "number") {
      console.log(`✅ extractUserId: Found userId as "${field}":`, value);
      return value;
    }
    
    // Also check if it's a string that can be converted to number
    if (typeof value === "string" && !isNaN(Number(value))) {
      const numValue = Number(value);
      console.log(`✅ extractUserId: Found userId as "${field}" (converted from string):`, numValue);
      return numValue;
    }
  }

  console.warn("⚠️  extractUserId: No valid user ID found in any field");
  console.warn("⚠️  Available fields were:", Object.keys(payload));
  return null;
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
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (STATIC_TOKEN) headers.Authorization = `Bearer ${STATIC_TOKEN}`;

  const res = await fetch(url, {
    cache: "no-store",
    ...init,
    headers: {
      ...headers,
      ...(init?.headers || {}),
    },
  });

  let data: unknown = null;
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) data = await res.json();
  else data = await res.text();

  return { ok: res.ok, status: res.status, json: data };
}

export async function GET(req: NextRequest) {
  try {
    console.log("🔐 GET /api/auth/me - Start");
    console.log("🔐 Looking for cookie:", COOKIE_NAME);
    
    const tokenCookie = req.cookies.get(COOKIE_NAME);
    console.log("🔐 Cookie found:", !!tokenCookie, "cookie keys:", Array.from(req.cookies).map(c => c[0]));
    
    const token = tokenCookie?.value;
    console.log("🔐 Token value exists:", !!token, "token length:", token?.length);

    if (!token) {
      console.warn("❌ GET /api/auth/me - No token in cookie");
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    console.log("🔑 Token found, decoding JWT...");
    const payload = decodeJwtPayload(token);
    
    if (!payload) {
      console.warn("❌ GET /api/auth/me - Failed to decode JWT");
      return NextResponse.json(
        { error: "Invalid token" },
        { status: 400 }
      );
    }

    console.log("✅ JWT Payload successfully decoded");
    console.log("📋 JWT Payload structure:", JSON.stringify(payload, null, 2));
    console.log("📋 JWT Payload keys:", Object.keys(payload));

    console.log("👤 Extracting user ID from JWT payload...");
    const userId = extractUserId(payload);

    if (!userId) {
      console.warn("❌ GET /api/auth/me - Unable to extract user ID from JWT");
      console.warn("❌ JWT Payload was:", JSON.stringify(payload, null, 2));
      console.warn("❌ JWT Payload keys were:", Object.keys(payload));
      return NextResponse.json(
        { 
          error: "Unable to extract user ID",
          details: "No user ID found in JWT. Available fields: " + Object.keys(payload).join(", "),
          jwt_payload_keys: Object.keys(payload),
        },
        { status: 400 }
      );
    }

    console.log(`✅ GET /api/auth/me - Extracted userId: ${userId}`);
    console.log(`🔄 Fetching user details for userId=${userId}`);
    
    const userRes = await directusFetch(
      `/items/user/${userId}?fields=user_id,user_fname,user_lname,user_email`
    );

    console.log(`📡 Directus user response status:`, userRes.status);

    const userData = (userRes.json as Record<string, unknown>)?.data as
      | Record<string, unknown>
      | undefined;

    if (!userData) {
      console.warn(`⚠️  User data not found in Directus response`);
    } else {
      console.log(`✅ User data from Directus:`, userData);
    }

    const response = {
      id: userId,
      user_fname: userData?.user_fname || null,
      user_lname: userData?.user_lname || null,
      user_email: userData?.user_email || null,
      payload,
    };

    console.log(`✅ GET /api/auth/me - Returning response:`, response);

    return NextResponse.json(response);
  } catch (e: unknown) {
    console.error("❌ GET /api/auth/me - Caught exception:", e);
    return NextResponse.json(
      { error: "Server error", message: String(e instanceof Error ? e.message : e) },
      { status: 500 }
    );
  }
}
