const DIRECTUS_URL_RAW = (
    process.env.DIRECTUS_URL
    || process.env.NEXT_PUBLIC_DIRECTUS_URL
    || process.env.NEXT_PUBLIC_API_BASE_URL
    || ""
).trim().replace(/\/+$/, "");
const DIRECTUS_URL = !DIRECTUS_URL_RAW
    ? ""
    : /^https?:\/\//i.test(DIRECTUS_URL_RAW)
        ? DIRECTUS_URL_RAW
        : "http://" + DIRECTUS_URL_RAW;
const DIRECTUS_TOKEN = (process.env.DIRECTUS_STATIC_TOKEN || "").trim();
const COOKIE_NAME = "vos_access_token";
const CUSTOMER_MEMO_LIST_PATH = "/fm/accounting/customer-credit-memo/customer-memo-list";

type JwtPayload = {
    sub?: string | number;
    id?: string | number;
    user_id?: string | number;
    exp?: number;
};

type DirectusUser = {
    role?: string | null;
    isAdmin?: boolean | number | null;
};

type ModuleAccessRow = {
    module_id?: {
        base_path?: string | null;
    } | null;
};

export type CustomerMemoEditAccess =
    | { ok: true; userId: number }
    | { ok: false; status: 401 | 403 | 503; error: string };

function decodeJwtPayload(token: string): JwtPayload | null {
    try {
        const payloadPart = token.split(".")[1];
        if (!payloadPart) return null;

        const padded = payloadPart + "=".repeat((4 - (payloadPart.length % 4)) % 4);
        const base64 = padded.replace(/-/g, "+").replace(/_/g, "/");
        return JSON.parse(Buffer.from(base64, "base64").toString("utf8")) as JwtPayload;
    } catch {
        return null;
    }
}

function normalizeModulePath(value: unknown): string {
    const path = String(value || "")
        .trim()
        .toLowerCase()
        .replace(/\\/g, "/")
        .replace(/\/+/g, "/");

    return path ? "/" + path.replace(/^\/+|\/+$/g, "") : "";
}

export function canEditPendingCreditMemo(status: unknown, type: unknown): boolean {
    return status === "FOR APPROVAL" && Number(type) === 1;
}

export function hasCustomerMemoListAccess(moduleRows: ModuleAccessRow[]): boolean {
    return moduleRows.some((row) => {
        const basePath = normalizeModulePath(row.module_id?.base_path);
        if (!basePath) return false;
        return basePath === CUSTOMER_MEMO_LIST_PATH
            || CUSTOMER_MEMO_LIST_PATH.startsWith(basePath + "/");
    });
}

export async function requireCustomerMemoModuleAccess(request: {
    cookies: { get: (name: string) => { value: string } | undefined };
}): Promise<CustomerMemoEditAccess> {
    const token = request.cookies.get(COOKIE_NAME)?.value;
    if (!token) return { ok: false, status: 401, error: "Unauthorized" };

    const payload = decodeJwtPayload(token);
    const userId = Number(payload?.sub ?? payload?.id ?? payload?.user_id);
    const expiresAt = Number(payload?.exp);
    if (
        !payload
        || !Number.isInteger(userId)
        || userId <= 0
        || !Number.isFinite(expiresAt)
        || expiresAt <= Math.floor(Date.now() / 1000)
    ) {
        return { ok: false, status: 401, error: "Invalid or expired session" };
    }

    if (!DIRECTUS_URL || !DIRECTUS_TOKEN) {
        return { ok: false, status: 503, error: "Authorization service is unavailable" };
    }

    const headers = { Authorization: "Bearer " + DIRECTUS_TOKEN };

    try {
        const [userResponse, moduleResponse] = await Promise.all([
            fetch(DIRECTUS_URL + "/items/user/" + userId + "?fields=role,isAdmin", {
                headers,
                cache: "no-store",
            }),
            fetch(DIRECTUS_URL + "/items/user_access_modules?filter[user_id][_eq]=" + userId + "&fields=module_id.base_path&limit=-1", {
                headers,
                cache: "no-store",
            }),
        ]);

        if (!userResponse.ok || !moduleResponse.ok) {
            return { ok: false, status: 503, error: "Authorization service is unavailable" };
        }

        const userPayload = await userResponse.json() as { data?: DirectusUser };
        const user = userPayload.data || {};
        const isAdmin = user.role === "ADMIN" || user.isAdmin === true || Number(user.isAdmin) === 1;
        if (isAdmin) return { ok: true, userId };

        const modulePayload = await moduleResponse.json() as { data?: ModuleAccessRow[] };
        if (!hasCustomerMemoListAccess(modulePayload.data || [])) {
            return { ok: false, status: 403, error: "You do not have access to Customer Memo." };
        }

        return { ok: true, userId };
    } catch {
        return { ok: false, status: 503, error: "Authorization service is unavailable" };
    }
}
