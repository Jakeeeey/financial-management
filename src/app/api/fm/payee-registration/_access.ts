import { cookies } from "next/headers";

import { COOKIE_NAME, decodeJwtPayload } from "@/lib/auth-utils";

const DIRECTUS_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN || "";
const PAYEE_REGISTRATION_BASE_PATH = "/fm/payee-registration";

type DirectusUser = {
  role?: string | null;
  isAdmin?: boolean | number | null;
};

type ModuleAccessRow = {
  module_id?: {
    slug?: string | null;
    base_path?: string | null;
  } | null;
};

export type PayeeMutationAccess =
  | { ok: true; userId: number }
  | { ok: false; status: 401 | 403 | 503; message: string };

function isAdmin(user: DirectusUser): boolean {
  return user.role === "ADMIN" || user.isAdmin === true || Number(user.isAdmin) === 1;
}

function normalizePath(value: unknown): string {
  const path = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\\/g, "/")
    .replace(/\/+/g, "/");

  return path ? `/${path.replace(/^\/+|\/+$/g, "")}` : "";
}

export function isPayeeRegistrationModule(module: ModuleAccessRow["module_id"]): boolean {
  const basePath = normalizePath(module?.base_path);
  const slug = String(module?.slug || "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-");

  return basePath === PAYEE_REGISTRATION_BASE_PATH
    || slug === "payee-registration"
    || (slug.includes("payee") && slug.includes("registration"));
}

/**
 * Payee writes use the same Directus module access source as the sidebar.
 * The BFF uses a service token to check the current session server-side.
 */
export async function requirePayeeRegistrationAccess(): Promise<PayeeMutationAccess> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) {
    return { ok: false, status: 401, message: "Unauthorized" };
  }

  const payload = decodeJwtPayload(token);
  const userId = Number(payload?.sub ?? payload?.id ?? payload?.user_id);
  if (!payload || !Number.isInteger(userId) || userId <= 0) {
    return { ok: false, status: 401, message: "Invalid session" };
  }

  if (!DIRECTUS_URL || !DIRECTUS_TOKEN) {
    return {
      ok: false,
      status: 503,
      message: "Authorization service is unavailable",
    };
  }

  const headers = { Authorization: `Bearer ${DIRECTUS_TOKEN}` };

  try {
    const [userResponse, moduleResponse] = await Promise.all([
      fetch(`${DIRECTUS_URL}/items/user/${userId}?fields=role,isAdmin`, {
        headers,
        cache: "no-store",
      }),
      fetch(
        `${DIRECTUS_URL}/items/user_access_modules?filter[user_id][_eq]=${userId}&fields=module_id.slug,module_id.base_path&limit=-1`,
        { headers, cache: "no-store" },
      ),
    ]);

    if (!userResponse.ok || !moduleResponse.ok) {
      return {
        ok: false,
        status: 503,
        message: "Authorization service is unavailable",
      };
    }

    const userPayload = await userResponse.json() as { data?: DirectusUser };
    if (isAdmin(userPayload.data || {})) return { ok: true, userId };

    const modulePayload = await moduleResponse.json() as { data?: ModuleAccessRow[] };
    const hasAccess = (modulePayload.data || []).some((row) =>
      isPayeeRegistrationModule(row.module_id),
    );

    return hasAccess
      ? { ok: true, userId }
      : {
        ok: false,
        status: 403,
        message: "You do not have access to Payee Registration.",
      };
  } catch {
    return {
      ok: false,
      status: 503,
      message: "Authorization service is unavailable",
    };
  }
}
