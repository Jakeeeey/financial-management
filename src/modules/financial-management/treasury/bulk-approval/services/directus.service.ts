// src/modules/financial-management/treasury/bulk-approval/services/directus.service.ts
import type { DirectusResponse } from "./bulkApproval.types";

const DIRECTUS_BASE = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") || "";
const STATIC_TOKEN = process.env.DIRECTUS_STATIC_TOKEN || "";

function headersToRecord(headers?: HeadersInit): Record<string, string> {
  if (!headers) return {};

  if (headers instanceof Headers) {
    const result: Record<string, string> = {};
    headers.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }

  if (Array.isArray(headers)) {
    return Object.fromEntries(headers);
  }

  return { ...headers };
}

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { Accept: "application/json" };
  const token = STATIC_TOKEN.trim();

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return { ...headers, ...extra };
}

export async function directusFetch<T = unknown>(
  path: string,
  init?: RequestInit
): Promise<DirectusResponse<T>> {
  if (!DIRECTUS_BASE) {
    return {
      ok: false,
      status: 500,
      data: {
        error: "NEXT_PUBLIC_API_BASE_URL not set",
        message: "Set NEXT_PUBLIC_API_BASE_URL in .env.local",
      } as T,
    };
  }

  const token = STATIC_TOKEN.trim();

  if (!token) {
    return {
      ok: false,
      status: 500,
      data: {
        error: "DIRECTUS_STATIC_TOKEN not set",
        message:
          "Set DIRECTUS_STATIC_TOKEN in .env.local. Use the raw Directus static token only. Do not include the word Bearer.",
      } as T,
    };
  }

  const initHeaders = headersToRecord(init?.headers);
  const headers = authHeaders(initHeaders);
  const url = `${DIRECTUS_BASE}${path.startsWith("/") ? "" : "/"}${path}`;

  const res = await fetch(url, {
    cache: "no-store",
    ...init,
    headers,
  });

  let data: unknown = null;
  const contentType = res.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    data = await res.json();
  } else {
    data = await res.text();
  }

  if (!res.ok && res.status === 401) {
    return {
      ok: false,
      status: res.status,
      data: {
        error: "Directus authentication failed",
        message:
          "Directus rejected DIRECTUS_STATIC_TOKEN. Make sure it is a valid Directus static token for the Directus instance in NEXT_PUBLIC_API_BASE_URL. Restart the Next.js dev server after changing .env.local.",
        details: data,
      } as T,
    };
  }

  if (!res.ok && res.status === 403) {
    return {
      ok: false,
      status: res.status,
      data: {
        error: "Directus permission or field error",
        message:
          "Directus returned 403. Check collection permissions and make sure every requested field exists in the target collection.",
        details: data,
      } as T,
    };
  }

  return {
    ok: res.ok,
    status: res.status,
    data: data as T,
  };
}
