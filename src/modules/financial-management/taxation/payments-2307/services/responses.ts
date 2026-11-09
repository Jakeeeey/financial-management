import "server-only";

import { NextResponse } from "next/server";

import { CompanyRequestError } from "./companyClient";
import { DirectusError } from "./directus";
import { NotLockedError } from "./locks.service";
import { RowNotFoundError, ScopeMismatchError } from "./rowErrors";

export function ok<T>(data: T): NextResponse {
  return NextResponse.json({ success: true, data });
}

export function fail(error: string, status: number, fieldErrors?: Record<string, string[]>): NextResponse {
  return NextResponse.json({ success: false, error, fieldErrors }, { status });
}

/**
 * One place that maps a service error to a status, so no route answers a 500 for a
 * row that simply is not there and no route leaks an unhandled throw.
 */
export function handleRouteError(tag: string, error: unknown): NextResponse {
  console.error(`[taxation/payments-2307 ${tag}]`, error);

  if (error instanceof RowNotFoundError) return fail(error.message, 404);
  if (error instanceof ScopeMismatchError) return fail(error.message, 409);
  if (error instanceof NotLockedError) return fail(error.message, 409);
  if (error instanceof DirectusError || error instanceof CompanyRequestError) {
    return fail(error.message, 502);
  }
  return fail(error instanceof Error ? error.message : "The request failed.", 500);
}

export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) return null;
    return body as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function parseRowId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}
