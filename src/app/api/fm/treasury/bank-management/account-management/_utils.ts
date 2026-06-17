// src/app/api/fm/treasury/bank-management/account-management/_utils.ts
import { NextResponse } from "next/server";

export const DIRECTUS_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");
export const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN || "";

export type DirectusList<T> = { data?: T[]; meta?: { filter_count?: number | string } };
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

export class ValidationError extends Error {
  status: number;
  fieldErrors: Record<string, string>;

  constructor(message: string, fieldErrors: Record<string, string>) {
    super(message);
    this.name = "ValidationError";
    this.status = 400;
    this.fieldErrors = fieldErrors;
  }
}

type FieldNameMap = Record<string, string>;
type DirectusErrorItem = {
  message?: unknown;
  extensions?: Record<string, unknown>;
};

function snakeToCamel(value: string) {
  return value.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

function directusErrors(body: string): DirectusErrorItem[] {
  try {
    const parsed = JSON.parse(body) as { errors?: DirectusErrorItem[] };
    return parsed.errors ?? [];
  } catch {
    return body ? [{ message: body }] : [];
  }
}

function humanizeFieldName(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function directusFieldNames(item: DirectusErrorItem) {
  const extensions = item.extensions ?? {};
  const candidates = [
    extensions.field,
    extensions.invalid,
    extensions.path,
    extensions.collection,
  ];
  const fields = new Set<string>();

  for (const candidate of candidates) {
    if (typeof candidate === "string") fields.add(candidate);
    if (Array.isArray(candidate)) {
      for (const value of candidate) {
        if (typeof value === "string") fields.add(value);
      }
    }
  }

  return Array.from(fields);
}

export function directusFieldErrors(
  error: DirectusRequestError,
  fieldMap: FieldNameMap = {},
) {
  const errors = directusErrors(error.body);
  const fieldErrors: Record<string, string> = {};
  const knownFields = Object.keys(fieldMap);

  for (const fieldName of knownFields) {
    const lowerField = fieldName.toLowerCase();
    const matchingError = errors.find((item) =>
      [
        typeof item.message === "string" ? item.message : "",
        typeof item.extensions?.reason === "string" ? item.extensions.reason : "",
        ...directusFieldNames(item),
      ]
        .join(" ")
        .toLowerCase()
        .includes(lowerField),
    );

    if (!matchingError) continue;

    const formField = fieldMap[fieldName] || snakeToCamel(fieldName);
    const matchingMessage = [
      typeof matchingError.message === "string" ? matchingError.message : "",
      typeof matchingError.extensions?.reason === "string"
        ? matchingError.extensions.reason
        : "",
    ]
      .filter(Boolean)
      .join(" ");
    const lowerMessage = matchingMessage.toLowerCase();

    fieldErrors[formField] =
      lowerMessage.includes("required") ||
      lowerMessage.includes("null") ||
      lowerMessage.includes("default") ||
      lowerMessage.includes("not nullable")
        ? "This field is required"
        : `${humanizeFieldName(formField)} needs attention`;
  }

  return fieldErrors;
}

export function jsonError(
  error: unknown,
  fallback = "Internal Server Error",
  fieldMap: FieldNameMap = {},
) {
  if (error instanceof ValidationError) {
    return NextResponse.json(
      {
        error: error.message,
        fieldErrors: error.fieldErrors,
      },
      { status: error.status },
    );
  }

  if (error instanceof DirectusRequestError) {
    const fieldErrors = directusFieldErrors(error, fieldMap);
    const hasFieldErrors = Object.keys(fieldErrors).length > 0;

    return NextResponse.json(
      {
        error: hasFieldErrors
          ? "Please review the highlighted fields"
          : error.message,
        details: error.body,
        ...(hasFieldErrors ? { fieldErrors } : {}),
      },
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
  return null;
}

export function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

export function asBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") return value === "1" || value.toLowerCase() === "true";
  return false;
}

export function sanitizeAccountNumber(value: unknown) {
  return asString(value).replace(/[^A-Za-z0-9-]/g, "").replace(/-+/g, "-");
}

export function sanitizeMobileNumber(value: unknown) {
  return asString(value).replace(/\D/g, "").slice(0, 20);
}

export function parseMoney(value: unknown) {
  if (typeof value === "string" && !value.trim()) return null;
  const parsed = typeof value === "number" ? value : Number(asString(value).replace(/,/g, ""));
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed * 100) / 100;
}

export function getTokenUserId(token: string | null | undefined) {
  if (!token) return null;

  try {
    const [, payload] = token.split(".");
    if (!payload) return null;
    const b64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const parsed = JSON.parse(Buffer.from(padded, "base64").toString("utf8")) as Record<string, unknown>;

    for (const key of ["id", "user_id", "userId", "sub"]) {
      const id = asNumber(parsed[key]);
      if (id) return id;
    }
  } catch {
    return null;
  }

  return null;
}

export function isFieldAccessError(error: unknown, fieldName: string) {
  if (!(error instanceof DirectusRequestError)) return false;
  const message = `${error.message} ${error.body}`.toLowerCase();
  return (error.status === 400 || error.status === 403) && message.includes(fieldName.toLowerCase());
}

export function isDirectusAccessError(error: unknown) {
  return error instanceof DirectusRequestError && (error.status === 400 || error.status === 403);
}
