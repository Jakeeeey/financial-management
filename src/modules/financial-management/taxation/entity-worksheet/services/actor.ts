import "server-only";

import { cookies } from "next/headers";

import { COOKIE_NAME, decodeJwtPayload } from "@/lib/auth-utils";

/** Who is writing, for `created_by` and every `tax_change_log` row. */
export interface Actor {
  userId: number | null;
  userName: string | null;
}

/**
 * Reads the signed-in user from the access-token cookie.
 *
 * A missing or unreadable cookie is not an error: an actor of `null` is still an honest
 * audit row ("the app could not name the user") rather than a fabricated name.
 */
export async function currentActor(): Promise<Actor> {
  const store = await cookies();
  const payload = decodeJwtPayload(store.get(COOKIE_NAME)?.value ?? "");
  if (!payload) return { userId: null, userName: null };

  const id = Number(payload.sub);
  // The token names the user as FirstName/LastName; the email is only a fallback so the
  // Change Log does not show one person in two formats.
  const name = [payload.FirstName, payload.LastName].filter(Boolean).join(" ").trim();

  return {
    userId: Number.isFinite(id) ? id : null,
    userName: name || payload.email || null,
  };
}
