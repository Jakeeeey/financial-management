import "server-only";

import { cookies } from "next/headers";

import { COOKIE_NAME, decodeJwtPayload } from "@/lib/auth-utils";

/** Who is writing, for `created_by` and every `tax_change_log` row. */
export interface Actor {
  userId: number | null;
  userName: string | null;
}

function clean(value: string | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed ? trimmed : null;
}

/**
 * Reads the signed-in user from the access-token cookie.
 *
 * A missing or unreadable cookie is not an error here: the middleware already guards
 * the route, and an actor of `null` is still an honest audit row ("the app could not
 * name the user") rather than a fabricated name.
 */
export async function currentActor(): Promise<Actor> {
  const store = await cookies();
  const payload = decodeJwtPayload(store.get(COOKIE_NAME)?.value ?? "");
  if (!payload) return { userId: null, userName: null };

  const id = Number(payload.sub);
  const userId = Number.isFinite(id) && id > 0 ? Math.trunc(id) : null;
  const name = [clean(payload.FirstName), clean(payload.LastName)].filter(Boolean).join(" ");
  return { userId, userName: clean(name) ?? clean(payload.email) };
}
