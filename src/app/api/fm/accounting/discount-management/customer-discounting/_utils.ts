import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const DIRECTUS_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");
export const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN || "";

export type DirectusList<T> = { data?: T[] };
export type DirectusItem<T> = { data?: T };

export class DirectusRequestError extends Error {
  status: number;
  body: string;

  constructor(message: string, status: number, body: string) {
    super(message);
    this.name = "DirectusRequestError";
    this.status = status;
    this.body = body;
  }
}

export function jsonError(error: unknown, fallback = "Internal Server Error") {
  if (error instanceof DirectusRequestError) {
    return NextResponse.json(
      { error: error.message, details: error.body },
      { status: error.status || 500 },
    );
  }

  return NextResponse.json(
    { error: error instanceof Error ? error.message : fallback },
    { status: 500 },
  );
}

export function directusHeaders(initHeaders?: HeadersInit): HeadersInit {
  if (!DIRECTUS_URL) throw new Error("NEXT_PUBLIC_API_BASE_URL is not configured");
  if (!DIRECTUS_TOKEN) throw new Error("DIRECTUS_STATIC_TOKEN is not configured");

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${DIRECTUS_TOKEN}`,
    ...(initHeaders instanceof Headers ? Object.fromEntries(initHeaders.entries()) : initHeaders ?? {}),
  };
}

export async function directusFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${DIRECTUS_URL}${path.startsWith("/") ? "" : "/"}${path}`;
  const res = await fetch(url, {
    cache: "no-store",
    ...init,
    headers: directusHeaders(init?.headers),
  });
  const text = await res.text().catch(() => "");

  if (!res.ok) {
    throw new DirectusRequestError(`Directus request failed (${res.status})`, res.status, text);
  }

  if (!text) return {} as T;

  try {
    return JSON.parse(text) as T;
  } catch {
    return text as T;
  }
}

export function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return asNumber(record.id ?? record.product_id ?? record.category_id);
  }

  return null;
}

export function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

export function relationId(value: unknown, fallbackKey?: string): number | null {
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return asNumber(record.id ?? (fallbackKey ? record[fallbackKey] : undefined));
  }

  return asNumber(value);
}

export function discountLabel(row: unknown) {
  if (!row || typeof row !== "object") return null;
  const record = row as Record<string, unknown>;
  const id = asNumber(record.id);
  if (!id) return null;

  return {
    id,
    discountType: asString(record.discount_type),
    totalPercent: asNumber(record.total_percent) ?? 0,
  };
}

export function addSoftDeleteFilters(params: URLSearchParams) {
  params.set("filter[deleted_at][_null]", "true");
}

export function isDeletedAtAccessError(error: unknown) {
  if (!(error instanceof DirectusRequestError)) return false;

  const message = `${error.message} ${error.body}`.toLowerCase();
  return (error.status === 400 || error.status === 403) && message.includes("deleted_at");
}

export function activeCustomerParams() {
  const params = new URLSearchParams();
  params.set("limit", "-1");
  params.set("sort", "customer_name");
  params.set(
    "fields",
    [
      "id",
      "customer_code",
      "customer_name",
      "store_name",
      "isActive",
      "discount_type",
      "discount_type.id",
      "discount_type.discount_type",
      "discount_type.total_percent",
    ].join(","),
  );
  params.set("filter[isActive][_eq]", "1");
  return params;
}

export function discountTypeParams() {
  const params = new URLSearchParams();
  params.set("limit", "-1");
  params.set("sort", "discount_type");
  params.set("fields", "id,discount_type,total_percent");
  return params;
}

export function tradeSupplierParams(q?: string) {
  const params = new URLSearchParams();
  params.set("limit", q ? "30" : "-1");
  params.set("sort", "supplier_name");
  params.set("fields", "id,supplier_name,supplier_shortcut,supplier_type,isActive");
  params.set("filter[isActive][_eq]", "1");
  params.set("filter[supplier_type][_eq]", "TRADE");
  if (q) params.set("search", q);
  return params;
}

export function categoryParams() {
  const params = new URLSearchParams();
  params.set("limit", "-1");
  params.set("sort", "category_name");
  params.set("fields", "category_id,category_name");
  return params;
}
