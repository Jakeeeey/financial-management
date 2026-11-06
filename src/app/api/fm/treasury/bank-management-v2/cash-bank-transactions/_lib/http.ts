import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { COOKIE_NAME, decodeJwtPayload } from "@/lib/auth-utils";
import { MAPPING_KEY_LABELS } from "@/modules/financial-management/treasury/bank-management-v2/cash-bank-transactions/constants";
import { fieldErrorsFromZod } from "@/modules/financial-management/treasury/bank-management-v2/cash-bank-transactions/schemas";
import { DirectusError } from "@/modules/financial-management/treasury/bank-management-v2/cash-bank-transactions/services/directus";
import {
  NotFoundError,
  ValidationError,
} from "@/modules/financial-management/treasury/bank-management-v2/cash-bank-transactions/services/errors";
import { PostingBlockedError } from "@/modules/financial-management/treasury/bank-management-v2/cash-bank-transactions/services/gl.service";

const LOG_PREFIX = "[cash-bank-transactions]";

/** `{ success: true, data }` — the only shape a happy response takes. */
export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

/** `{ success: false, error }` plus whatever the caller needs to explain it. */
export function fail(error: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ success: false, error, ...extra }, { status });
}

/** The signed-in user from the access-token cookie; `null` when the token carries no id. */
export async function currentUserId(): Promise<number | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  const payload = token ? decodeJwtPayload(token) : null;
  const id = Number(payload?.sub);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** "the bank charges expense account and the transfer-in-transit clearing account". */
export function missingMappingCopy(keys: string[]): string {
  const names = keys.map((key) => MAPPING_KEY_LABELS[key] ?? "a ledger account");
  if (!names.length) return "Ask accounting to map the ledger accounts this transaction needs.";
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  return `Ask accounting to map ${list} before this transaction can post.`;
}

/**
 * One place that turns a thrown error into the contract's status codes:
 * Zod 400, field-less business rule 409, field rule 400, missing row 404,
 * unmapped ledger 409 with the keys, anything Directus 500 (schema not applied yet).
 */
export function handleRouteError(error: unknown, context: string, fallback: string) {
  if (error instanceof z.ZodError) {
    return fail("Some fields need attention.", 400, { fieldErrors: fieldErrorsFromZod(error) });
  }
  if (error instanceof PostingBlockedError) {
    return fail(missingMappingCopy(error.missingMappingKeys), 409, {
      missingMappingKeys: error.missingMappingKeys,
    });
  }
  if (error instanceof ValidationError) {
    return fail(
      error.message,
      error.field ? 400 : 409,
      error.field ? { fieldErrors: { [error.field]: error.message } } : undefined,
    );
  }
  if (error instanceof NotFoundError) return fail(error.message, 404);
  if (error instanceof DirectusError) {
    console.error(`${LOG_PREFIX} ${context}: directus ${error.status}`, error.body);
    return fail(
      "The bank transaction tables are not ready yet, so this was not saved. Ask an administrator to apply the Bank Management V2 schema.",
      500,
    );
  }
  console.error(`${LOG_PREFIX} ${context}`, error);
  return fail(fallback, 500);
}

/** Reads a JSON body, or answers undefined so the caller can return its own 400. */
export async function readJson(request: Request): Promise<unknown | undefined> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

/** A positive integer route or query id, else `null`. */
export function toId(raw: string | number | null | undefined): number | null {
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : null;
}
