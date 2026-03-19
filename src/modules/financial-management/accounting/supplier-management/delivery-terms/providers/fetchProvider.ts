"use client";

import type { DeliveryTermRow, DeliveryTermPayload } from "../types";

const API_BASE = "/api/fm/accounting/supplier-management/delivery-terms";

interface ListResponse {
  data?: DeliveryTermRow[];
  meta?: {
    filter_count?: number;
    total_count?: number;
  };
  paging?: {
    page: number;
    pageSize: number;
  };
}

async function safeJson(res: Response) {
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  return res.text();
}

function errMsg(data: unknown): string {
  if (!data) return "Request failed";
  if (typeof data === "string") return data;
  const d = data as Record<string, unknown>;
  const errors = d?.errors as Array<Record<string, unknown>> | undefined;
  const msg = errors?.[0]?.message || d?.message || d?.error || "Request failed";
  return String(msg);
}

export async function listDeliveryTerms(params: {
  q?: string;
  page?: number;
  pageSize?: number;
}): Promise<ListResponse> {
  const query = new URLSearchParams();

  if (params.q) query.set("q", params.q);
  if (params.page) query.set("page", String(params.page));
  if (params.pageSize) query.set("pageSize", String(params.pageSize));

  const res = await fetch(`${API_BASE}?${query.toString()}`);
  const data = await safeJson(res);
  if (!res.ok) throw new Error(errMsg(data));
  return data as ListResponse;
}

export async function createDeliveryTerm(payload: DeliveryTermPayload): Promise<DeliveryTermRow> {
  const res = await fetch(API_BASE, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await safeJson(res);
  if (!res.ok) throw new Error(errMsg(data));
  return data as DeliveryTermRow;
}

export async function updateDeliveryTerm(
  id: number,
  payload: Partial<DeliveryTermPayload>
): Promise<DeliveryTermRow> {
  const res = await fetch(API_BASE, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id, payload }),
  });

  const data = await safeJson(res);
  if (!res.ok) throw new Error(errMsg(data));
  return data as DeliveryTermRow;
}

export async function deleteDeliveryTerm(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  });

  const data = await safeJson(res);
  if (!res.ok) throw new Error(errMsg(data));
}

export async function checkDeliveryNameExists(deliveryName: string): Promise<boolean> {
  const res = await fetch(
    `${API_BASE}?q=${encodeURIComponent(deliveryName)}&pageSize=1`
  );
  const data = await safeJson(res);
  if (!res.ok) return false;
  
  const rows = (data as ListResponse)?.data ?? [];
  return rows.some(
    (row) => row.delivery_name.toLowerCase() === deliveryName.toLowerCase()
  );
}

export async function getCurrentUserId(): Promise<number | null> {
  try {
    console.log("🔄 Calling /api/auth/me...");
    const res = await fetch("/api/auth/me", {
      method: "GET",
      credentials: "include",
    });

    console.log("📡 /api/auth/me response status:", res.status);
    
    if (!res.ok) {
      console.warn("❌ /api/auth/me returned non-OK status:", res.status);
      const errorData = await res.json();
      console.error("❌ Error response from /api/auth/me:", errorData);
      console.error("❌ Error details:", errorData.details);
      console.error("❌ JWT payload keys available:", errorData.jwt_payload_keys);
      return null;
    }

    const data = (await res.json()) as Record<string, unknown>;
    console.log("📊 /api/auth/me full response data:", JSON.stringify(data, null, 2));
    
    // Try multiple possible ID field names
    let userId: number | null = null;
    
    if (typeof data.id === "number") {
      userId = data.id;
      console.log("✅ Found userId via data.id:", userId);
    } else if (typeof data.user_id === "number") {
      userId = data.user_id;
      console.log("✅ Found userId via data.user_id:", userId);
    } else {
      console.warn("⚠️  No numeric ID found in response. Available keys:", Object.keys(data));
    }

    console.log("🔍 Final extracted userId:", userId, "type:", typeof userId);
    return userId;
  } catch (e) {
    console.error("❌ getCurrentUserId error:", e);
    return null;
  }
}

interface UserInfo {
  id: number;
  user_fname: string | null;
  user_lname: string | null;
  user_email: string | null;
}

const userCache = new Map<number, UserInfo>();

export async function fetchUserInfo(userId: number): Promise<UserInfo | null> {
  // Check cache first
  if (userCache.has(userId)) {
    console.log(`✅ User ${userId} found in cache`);
    return userCache.get(userId) || null;
  }

  try {
    console.log(`🔄 Fetching user info for userId: ${userId}`);
    const res = await fetch(`/api/auth/users/${userId}`);
    
    console.log(`📡 /api/auth/users/${userId} response status:`, res.status);
    
    if (!res.ok) {
      console.warn(`❌ /api/auth/users/${userId} returned status ${res.status}`);
      return null;
    }

    const data = (await res.json()) as UserInfo;
    console.log(`✅ User ${userId} data:`, data);
    
    userCache.set(userId, data);
    return data;
  } catch (e) {
    console.error(`❌ fetchUserInfo error for userId ${userId}:`, e);
    return null;
  }
}

export function getUserDisplayName(user: UserInfo | null): string {
  if (!user) return "-";
  const fname = user.user_fname || "";
  const lname = user.user_lname || "";
  return `${fname} ${lname}`.trim() || "-";
}
