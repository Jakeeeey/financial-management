// src/app/api/claims/for-receiving/transmittal-for-receiving/route.ts
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

async function directusJson<T>(path: string, init?: RequestInit): Promise<T> {
    const { res, json } = await directusFetch(path, init);
    if (!res.ok) {
        throw new Error(typeof json === "string" ? json : JSON.stringify(json ?? {}));
    }
    return json as T;
}

/* ================= Types ================= */

type DirectusListResponse<T> = { data?: T[] };

type TransmittalRow = Record<string, unknown> & {
    id?: number | string | null;
    transmittal_no?: string | null;
    supplier_id?: number | string | null;
    supplier_representative_id?: number | string | null;
    status?: string | null;
    created_at?: string | null;

    created_by?: number | string | null;
    encoder_id?: number | string | null;
    createdBy?: number | string | null;
    encoderId?: number | string | null;
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
    last_name?: string | null;
    middle_name?: string | null;
    suffix?: string | null;
    supplier_id?: number | string | null;
};

type DetailGroupedRow = {
    claims_transmittal_id?: number | string | null;
    count?: { id?: number | string | null } | number | string | null;
};

/* ================= Utils ================= */

function isRecord(v: unknown): v is Record<string, unknown> {
    return typeof v === "object" && v !== null;
}

function safeText(v: unknown): string {
    return typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();
}

function toNum(v: unknown): number | null {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : null;
}

function errMessage(e: unknown): string {
    if (e && typeof e === "object" && "message" in e) {
        const msg = (e as { message?: unknown }).message;
        return typeof msg === "string" ? msg : String(msg ?? e);
    }
    return String(e);
}

/**
 * Decode JWT payload (NO VERIFY) and extract numeric userId from `sub`.
 */
function decodeUserIdFromJwtCookie(req: NextRequest, cookieName = "vos_access_token"): number | null {
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

        const payload = isRecord(payloadUnknown) ? payloadUnknown : null;
        const userId = Number(payload?.sub);
        return Number.isFinite(userId) ? userId : null;
    } catch {
        return null;
    }
}

function pickCreatedById(t: TransmittalRow): number | null {
    // preserve original priority: created_by ?? encoder_id ?? createdBy ?? encoderId
    return toNum(t?.created_by) ?? toNum(t?.encoder_id) ?? toNum(t?.createdBy) ?? toNum(t?.encoderId) ?? null;
}

function joinUserName(u: UserRow): string {
    const name = [u.user_fname, u.user_mname, u.user_lname]
        .map((x) => safeText(x))
        .filter(Boolean)
        .join(" ")
        .trim();

    return name || safeText(u.user_email) || `User #${toNum(u.user_id) ?? "—"}`;
}

function joinRepName(r: RepRow): string {
    // keep original output: [first, middle, last, suffix].filter(Boolean).join(" ")
    return [r.first_name, r.middle_name, r.last_name, r.suffix]
        .map((x) => safeText(x))
        .filter(Boolean)
        .join(" ")
        .trim();
}

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

        const listJson = await directusJson<DirectusListResponse<TransmittalRow>>(
            `/items/${TRANSMITTAL_COLLECTION}?${params.toString()}`
        );
        const rows = Array.isArray(listJson?.data) ? listJson.data : [];

        const userIds = Array.from(
            new Set(
                rows
                    .map((r) => pickCreatedById(r))
                    .filter((n): n is number => typeof n === "number" && Number.isFinite(n) && n > 0)
            )
        );

        const userMap = new Map<number, string>();

        if (userIds.length) {
            const up = new URLSearchParams();
            up.set("limit", String(Math.max(50, userIds.length)));
            up.set("fields", "user_id,user_fname,user_mname,user_lname,user_email");
            up.set("filter[user_id][_in]", userIds.join(","));

            const usersJson = await directusJson<DirectusListResponse<UserRow>>(
                `/items/${USERS_COLLECTION}?${up.toString()}`
            );

            (Array.isArray(usersJson?.data) ? usersJson.data : []).forEach((u) => {
                const id = toNum(u?.user_id);
                if (!id) return;
                userMap.set(id, joinUserName(u));
            });
        }

        // 2) batch fetch supplier + rep labels
        const supplierIds = Array.from(
            new Set(
                rows
                    .map((r) => toNum(r.supplier_id))
                    .filter((n): n is number => typeof n === "number" && Number.isFinite(n) && n > 0)
            )
        );
        const repIds = Array.from(
            new Set(
                rows
                    .map((r) => toNum(r.supplier_representative_id))
                    .filter((n): n is number => typeof n === "number" && Number.isFinite(n) && n > 0)
            )
        );

        const supplierMap = new Map<number, SupplierRow>();
        const repMap = new Map<number, RepRow>();

        if (supplierIds.length) {
            const sp = new URLSearchParams();
            sp.set("limit", String(Math.max(20, supplierIds.length)));
            sp.set("fields", "id,supplier_name,supplier_shortcut");
            sp.set("filter[id][_in]", supplierIds.join(","));
            const supJson = await directusJson<DirectusListResponse<SupplierRow>>(
                `/items/${SUPPLIERS_COLLECTION}?${sp.toString()}`
            );
            (Array.isArray(supJson?.data) ? supJson.data : []).forEach((s) => {
                supplierMap.set(Number(s.id), s);
            });
        }

        if (repIds.length) {
            const rp = new URLSearchParams();
            rp.set("limit", String(Math.max(20, repIds.length)));
            rp.set("fields", "id,first_name,last_name,middle_name,suffix,supplier_id");
            rp.set("filter[id][_in]", repIds.join(","));
            const repJson = await directusJson<DirectusListResponse<RepRow>>(
                `/items/${REPS_COLLECTION}?${rp.toString()}`
            );
            (Array.isArray(repJson?.data) ? repJson.data : []).forEach((r) => {
                repMap.set(Number(r.id), r);
            });
        }

        // 3) batch compute ccm_count (groupBy + aggregate)
        const idList = rows
            .map((r) => toNum(r.id))
            .filter((n): n is number => typeof n === "number" && Number.isFinite(n) && n > 0);

        const countMap = new Map<number, number>();

        if (idList.length) {
            const cp = new URLSearchParams();
            cp.set("filter[claims_transmittal_id][_in]", idList.join(","));
            cp.set("aggregate[count]", "id");
            cp.append("groupBy[]", "claims_transmittal_id");
            cp.set("fields", "claims_transmittal_id"); // ensure group field is present

            const countJson = await directusJson<DirectusListResponse<DetailGroupedRow>>(
                `/items/${DETAILS_COLLECTION}?${cp.toString()}`
            );
            const grouped = Array.isArray(countJson?.data) ? countJson.data : [];

            grouped.forEach((g) => {
                const tid = toNum(g?.claims_transmittal_id);
                if (!tid) return;

                const rawCount = isRecord(g?.count) ? (g.count as { id?: unknown }).id : g?.count;
                const c = Number(rawCount ?? 0);

                countMap.set(tid, Number.isFinite(c) ? c : 0);
            });
        }

        const enriched = rows.map((t) => {
            const s = supplierMap.get(Number(t.supplier_id));
            const r = repMap.get(Number(t.supplier_representative_id));

            const supplierLabel = s
                ? s.supplier_shortcut
                    ? `${safeText(s.supplier_name)} (${safeText(s.supplier_shortcut)})`
                    : safeText(s.supplier_name)
                : null;

            const repLabel = r ? joinRepName(r) : null;

            const createdById = pickCreatedById(t);

            return {
                ...t,
                supplier_name: supplierLabel,
                representative_name: repLabel,
                ccm_count: countMap.get(Number(t.id)) ?? 0,
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

type PostBody = { transmittal_id?: unknown };

export async function POST(req: NextRequest) {
    try {
        const userId = decodeUserIdFromJwtCookie(req);
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized (missing/invalid token)" }, { status: 401 });
        }

        const bodyUnknown: unknown = await req.json();
        const body: PostBody = isRecord(bodyUnknown) ? (bodyUnknown as PostBody) : {};

        const transmittal_id = Number(body.transmittal_id);

        if (!transmittal_id || Number.isNaN(transmittal_id)) {
            return NextResponse.json({ error: "transmittal_id is required" }, { status: 400 });
        }

        await directusJson<unknown>(`/items/${TRANSMITTAL_COLLECTION}/${transmittal_id}`, {
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