// src/app/api/claims/for-receiving/transmittal-send-to-payment/route.ts
import "server-only";

import { NextRequest, NextResponse } from "next/server";

const TRANSMITTAL_COLLECTION = "claims_transmittal";
const DETAILS_COLLECTION = "claims_transmittal_details";
const SUPPLIERS_COLLECTION = "suppliers";
const REPS_COLLECTION = "suppliers_representative";
const USERS_COLLECTION = "user";

/* ================= Directus helpers (inlined) ================= */

const DIRECTUS_URL: string | undefined = process.env.NEXT_PUBLIC_API_BASE_URL;

function directusHeaders(): Record<string, string> {
    const token: string | undefined = process.env.DIRECTUS_STATIC_TOKEN;

    if (!DIRECTUS_URL) throw new Error("Missing DIRECTUS_URL");
    if (!token) throw new Error("Missing DIRECTUS_STATIC_TOKEN");

    return {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
    };
}

async function directusFetch(
    path: string,
    init?: RequestInit
): Promise<{ res: Response; json: unknown }> {
    if (!DIRECTUS_URL) throw new Error("Missing DIRECTUS_URL");

    const res = await fetch(`${DIRECTUS_URL}${path}`, {
        ...init,
        headers: {
            ...directusHeaders(),
            ...(init?.headers ?? {}),
        },
        cache: "no-store",
    });

    const json: unknown = await res.json().catch(() => ({}));
    return { res, json };
}

async function directusJson(path: string, init?: RequestInit): Promise<unknown> {
    const { res, json } = await directusFetch(path, init);
    if (!res.ok) {
        throw new Error(typeof json === "string" ? json : JSON.stringify(json ?? {}));
    }
    return json as unknown;
}

/* ================= Types + Utils ================= */

type DirectusListResponse<T> = { data?: T[]; error?: unknown };

type UnknownRecord = Record<string, unknown>;

function isRecord(v: unknown): v is UnknownRecord {
    return typeof v === "object" && v !== null && !Array.isArray(v);
}

function safeStr(v: unknown): string {
    return typeof v === "string" ? v : v == null ? "" : String(v);
}

function safeNum(v: unknown, fallback = 0): number {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : fallback;
}

function toPosInt(v: unknown): number | null {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

function errMessage(e: unknown): string {
    if (isRecord(e) && "message" in e) return safeStr(e.message);
    return safeStr(e);
}

/**
 * Decode JWT payload (NO VERIFY) and extract numeric userId from `sub`.
 */
function decodeUserIdFromJwtCookie(
    req: NextRequest,
    cookieName = "vos_access_token"
): number | null {
    const token = req.cookies.get(cookieName)?.value;
    if (!token) return null;

    const parts = token.split(".");
    if (parts.length < 2) return null;

    try {
        const payloadPart = parts[1];
        const pad = "=".repeat((4 - (payloadPart.length % 4)) % 4);
        const b64 = (payloadPart + pad).replace(/-/g, "+").replace(/_/g, "/");
        const jsonStr = Buffer.from(b64, "base64").toString("utf8");
        const payloadUnknown: unknown = JSON.parse(jsonStr);

        if (!isRecord(payloadUnknown)) return null;
        const userId = Number(payloadUnknown.sub);
        return Number.isFinite(userId) ? userId : null;
    } catch {
        return null;
    }
}

type TransmittalRow = {
    id?: number | string | null;
    transmittal_no?: string | null;
    status?: string | null;
    supplier_id?: number | string | null;
    supplier_representative_id?: number | string | null;
    created_by?: number | string | null;
    encoder_id?: number | string | null;
    createdBy?: number | string | null;
    encoderId?: number | string | null;
    created_at?: string | null;
    [k: string]: unknown;
};

type UserRow = {
    user_id?: number | string | null;
    user_fname?: string | null;
    user_mname?: string | null;
    user_lname?: string | null;
    user_email?: string | null;
};

type SupplierRow = {
    id?: number | string | null;
    supplier_name?: string | null;
    supplier_shortcut?: string | null;
};

type RepRow = {
    id?: number | string | null;
    first_name?: string | null;
    middle_name?: string | null;
    last_name?: string | null;
    suffix?: string | null;
    supplier_id?: number | string | null;
};

type GroupedCountRow = {
    claims_transmittal_id?: number | string | null;
    count?: { id?: number | string | null } | number | string | null;
};

/* ================= Routes ================= */

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const q = (searchParams.get("q") ?? "").trim();
        const supplierId = (searchParams.get("supplier_id") ?? "").trim();

        // 1) fetch transmittals (FOR RECEIVING)
        const params = new URLSearchParams();
        params.set("limit", "200");
        params.set("sort", "-created_at");
        params.set("fields", "*"); // ✅ avoids field-does-not-exist errors
        params.set("filter[status][_eq]", "FOR RECEIVING");

        if (supplierId && !Number.isNaN(Number(supplierId))) {
            params.set("filter[supplier_id][_eq]", supplierId);
        }

        if (q) {
            params.set("filter[_or][0][transmittal_no][_icontains]", q);
            params.set("filter[_or][1][status][_icontains]", q);
        }

        const listUnknown = await directusJson(
            `/items/${TRANSMITTAL_COLLECTION}?${params.toString()}`
        );
        const listJson = listUnknown as DirectusListResponse<TransmittalRow>;
        const rows: TransmittalRow[] = Array.isArray(listJson?.data) ? listJson.data : [];

        const userIds = Array.from(
            new Set(
                rows
                    .map((r) => toPosInt(r?.created_by ?? r?.encoder_id ?? r?.createdBy ?? r?.encoderId))
                    .filter((n): n is number => n != null)
            )
        );

        const userMap = new Map<number, string>();

        if (userIds.length) {
            const up = new URLSearchParams();
            up.set("limit", String(Math.max(50, userIds.length)));
            up.set("fields", "user_id,user_fname,user_mname,user_lname,user_email");
            up.set("filter[user_id][_in]", userIds.join(","));

            const usersUnknown = await directusJson(`/items/${USERS_COLLECTION}?${up.toString()}`);
            const usersJson = usersUnknown as DirectusListResponse<UserRow>;
            const users: UserRow[] = Array.isArray(usersJson?.data) ? usersJson.data : [];

            users.forEach((u) => {
                const id = toPosInt(u?.user_id);
                if (!id) return;

                const name = [u?.user_fname, u?.user_mname, u?.user_lname]
                    .map((x) => safeStr(x).trim())
                    .filter(Boolean)
                    .join(" ")
                    .trim();

                userMap.set(id, name || safeStr(u?.user_email).trim() || `User #${id}`);
            });
        }

        // 2) batch fetch supplier + rep labels
        const supplierIds = Array.from(
            new Set(rows.map((r) => toPosInt(r?.supplier_id)).filter((n): n is number => n != null))
        );

        const repIds = Array.from(
            new Set(
                rows
                    .map((r) => toPosInt(r?.supplier_representative_id))
                    .filter((n): n is number => n != null)
            )
        );

        const supplierMap = new Map<number, SupplierRow>();
        const repMap = new Map<number, RepRow>();

        if (supplierIds.length) {
            const sp = new URLSearchParams();
            sp.set("limit", String(Math.max(20, supplierIds.length)));
            sp.set("fields", "id,supplier_name,supplier_shortcut");
            sp.set("filter[id][_in]", supplierIds.join(","));

            const supUnknown = await directusJson(`/items/${SUPPLIERS_COLLECTION}?${sp.toString()}`);
            const supJson = supUnknown as DirectusListResponse<SupplierRow>;
            const sups: SupplierRow[] = Array.isArray(supJson?.data) ? supJson.data : [];

            sups.forEach((s) => {
                const id = toPosInt(s?.id);
                if (!id) return;
                supplierMap.set(id, s);
            });
        }

        if (repIds.length) {
            const rp = new URLSearchParams();
            rp.set("limit", String(Math.max(20, repIds.length)));
            rp.set("fields", "id,first_name,last_name,middle_name,suffix,supplier_id");
            rp.set("filter[id][_in]", repIds.join(","));

            const repUnknown = await directusJson(`/items/${REPS_COLLECTION}?${rp.toString()}`);
            const repJson = repUnknown as DirectusListResponse<RepRow>;
            const reps: RepRow[] = Array.isArray(repJson?.data) ? repJson.data : [];

            reps.forEach((r) => {
                const id = toPosInt(r?.id);
                if (!id) return;
                repMap.set(id, r);
            });
        }

        // 3) batch compute ccm_count (groupBy + aggregate)
        const idList = rows.map((r) => toPosInt(r?.id)).filter((n): n is number => n != null);
        const countMap = new Map<number, number>();

        if (idList.length) {
            const cp = new URLSearchParams();
            cp.set("filter[claims_transmittal_id][_in]", idList.join(","));
            cp.set("aggregate[count]", "id");
            cp.append("groupBy[]", "claims_transmittal_id");
            cp.set("fields", "claims_transmittal_id"); // ensure group field is present

            const countUnknown = await directusJson(`/items/${DETAILS_COLLECTION}?${cp.toString()}`);
            const countJson = countUnknown as DirectusListResponse<GroupedCountRow>;
            const grouped: GroupedCountRow[] = Array.isArray(countJson?.data) ? countJson.data : [];

            grouped.forEach((g) => {
                const tid = toPosInt(g?.claims_transmittal_id);
                if (!tid) return;

                const countVal = g?.count;
                const c =
                    typeof countVal === "number" || typeof countVal === "string"
                        ? safeNum(countVal, 0)
                        : isRecord(countVal)
                            ? safeNum(countVal.id, 0)
                            : 0;

                countMap.set(tid, Number.isFinite(c) ? c : 0);
            });
        }

        const enriched = rows.map((t) => {
            const s = supplierMap.get(toPosInt(t?.supplier_id) ?? -1);
            const r = repMap.get(toPosInt(t?.supplier_representative_id) ?? -1);

            const supplierLabel = s
                ? safeStr(s.supplier_shortcut).trim()
                    ? `${safeStr(s.supplier_name).trim()} (${safeStr(s.supplier_shortcut).trim()})`
                    : safeStr(s.supplier_name).trim() || null
                : null;

            const repLabel = r
                ? [r.first_name, r.middle_name, r.last_name, r.suffix]
                .map((x) => safeStr(x).trim())
                .filter(Boolean)
                .join(" ")
                .trim() || null
                : null;

            const createdById = toPosInt(t?.created_by ?? t?.encoder_id ?? t?.createdBy ?? t?.encoderId);

            return {
                ...t,
                supplier_name: supplierLabel,
                representative_name: repLabel,
                ccm_count: countMap.get(toPosInt(t?.id) ?? -1) ?? 0,
                created_by_id: createdById,
                created_by_name: createdById ? userMap.get(createdById) ?? null : null,
            };
        });

        return NextResponse.json({ data: enriched }, { status: 200 });
    } catch (e: unknown) {
        return NextResponse.json(
            { error: "Unexpected error", details: errMessage(e) },
            { status: 500 }
        );
    }
}

export async function POST(req: NextRequest) {
    try {
        const userId = decodeUserIdFromJwtCookie(req);
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized (missing/invalid token)" }, { status: 401 });
        }

        const bodyUnknown: unknown = await req.json().catch(() => ({} as unknown));
        const transmittalIdRaw =
            isRecord(bodyUnknown) && "transmittal_id" in bodyUnknown ? bodyUnknown.transmittal_id : null;

        const transmittal_id = toPosInt(transmittalIdRaw);

        if (!transmittal_id) {
            return NextResponse.json({ error: "transmittal_id is required" }, { status: 400 });
        }

        await directusJson(`/items/${TRANSMITTAL_COLLECTION}/${transmittal_id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                status: "FOR PAYMENT",
                updated_by: userId,
            }),
        });

        return NextResponse.json({ data: { ok: true } }, { status: 200 });
    } catch (e: unknown) {
        return NextResponse.json(
            { error: "Unexpected error", details: errMessage(e) },
            { status: 500 }
        );
    }
}