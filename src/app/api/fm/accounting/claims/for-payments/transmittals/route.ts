// src/app/api/claims/for-payments/transmittals/route.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const DIRECTUS_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/+$/, "") + "/";

function directusHeaders() {
    const token = process.env.DIRECTUS_STATIC_TOKEN;
    if (!DIRECTUS_URL) throw new Error("DIRECTUS_URL is not configured");
    if (!token) throw new Error("DIRECTUS_SERVICE_TOKEN is not configured");
    return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

function toNum(v: unknown): number | null {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
}

function uniqNums(values: unknown[]): number[] {
    const out: number[] = [];
    const seen = new Set<number>();
    for (const v of values) {
        const n = toNum(v);
        if (!n) continue;
        if (seen.has(n)) continue;
        seen.add(n);
        out.push(n);
    }
    return out;
}

function safeText(v: unknown) {
    return typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();
}

function joinName(parts: unknown[]) {
    return parts.map(safeText).filter(Boolean).join(" ").trim();
}

type DirectusListResponse<T> = { data?: T[] };

type ClaimsTransmittalRow = {
    id?: number | string | null;
    transmittal_no?: string | null;
    status?: string | null;
    created_at?: string | null;
    created_by?: number | string | null;
    total_amount?: number | string | null;

    supplier_id?: SupplierRel | number | string | null;
    supplier_representative_id?: RepresentativeRel | number | string | null;
};

type SupplierRel = {
    id?: number | string | null;
    supplier_name?: string | null;
};

type RepresentativeRel = {
    id?: number | string | null;
    first_name?: string | null;
    middle_name?: string | null;
    last_name?: string | null;
    suffix?: string | null;
};

type UserRow = {
    user_id?: number | string | null;
    user_fname?: string | null;
    user_mname?: string | null;
    user_lname?: string | null;
    user_email?: string | null;
};

function isRecord(v: unknown): v is Record<string, unknown> {
    return typeof v === "object" && v !== null;
}

async function directusGet<T>(pathAndQuery: string): Promise<T> {
    const r = await fetch(`${DIRECTUS_URL}/items/${pathAndQuery}`, {
        method: "GET",
        headers: directusHeaders(),
        cache: "no-store",
    });

    const jsonUnknown: unknown = await r.json().catch(() => ({} as unknown));
    if (!r.ok) throw new Error(JSON.stringify(jsonUnknown ?? {}));
    return jsonUnknown as T;
}

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const status = (searchParams.get("status") ?? "").trim();

        const params = new URLSearchParams();
        params.set("limit", "200");
        params.set("sort", "-id");
        params.set(
            "fields",
            [
                "id",
                "transmittal_no",
                "status",
                "created_at",
                "created_by", // ✅ numeric id in your DB
                "total_amount",

                // supplier relation
                "supplier_id.id",
                "supplier_id.supplier_name",

                // representative relation (allowed fields)
                "supplier_representative_id.id",
                "supplier_representative_id.first_name",
                "supplier_representative_id.middle_name",
                "supplier_representative_id.last_name",
                "supplier_representative_id.suffix",
            ].join(",")
        );

        if (status) params.set("filter[status][_eq]", status);

        const r = await fetch(`${DIRECTUS_URL}items/claims_transmittal?${params.toString()}`, {
            method: "GET",
            headers: directusHeaders(),
            cache: "no-store",
        });

        const jsonUnknown: unknown = await r.json().catch(() => ({} as unknown));

        if (!r.ok) {
            return NextResponse.json(
                { error: "Directus error", details: JSON.stringify(jsonUnknown) },
                { status: r.status }
            );
        }

        const list = jsonUnknown as DirectusListResponse<ClaimsTransmittalRow>;
        const raw = Array.isArray(list?.data) ? list.data : [];

        // ✅ Collect created_by numeric ids
        const createdByIds = uniqNums(raw.map((row) => row?.created_by));

        // ✅ Map user_id -> display name
        const userNameById = new Map<number, string>();

        if (createdByIds.length) {
            try {
                const up = new URLSearchParams();
                up.set("limit", String(Math.max(200, createdByIds.length)));

                // ✅ IMPORTANT: your user table uses user_id (not id)
                up.set(
                    "fields",
                    ["user_id", "user_fname", "user_mname", "user_lname", "user_email"].join(",")
                );

                // ✅ IMPORTANT: filter by user_id (not id)
                up.set("filter[user_id][_in]", createdByIds.join(","));

                // collection is "user" based on your samples: items/user
                const uJson = await directusGet<DirectusListResponse<UserRow>>(`user?${up.toString()}`);
                const users = Array.isArray(uJson?.data) ? uJson.data : [];

                for (const u of users) {
                    const id = toNum(u?.user_id);
                    if (!id) continue;

                    const display =
                        joinName([u.user_fname, u.user_mname, u.user_lname]) ||
                        safeText(u.user_email) ||
                        `User #${id}`;

                    userNameById.set(id, display);
                }
            } catch {
                // if user collection is restricted, we'll fall back to User #id
            }
        }

        const data = raw.map((row) => {
            const supplierObj = row.supplier_id;
            const repObj = row.supplier_representative_id;

            const supplierIsObj = isRecord(supplierObj);
            const repIsObj = isRecord(repObj);

            const supplier_id = supplierIsObj
                ? toNum((supplierObj as SupplierRel)?.id)
                : toNum(row.supplier_id);

            const supplier_name = supplierIsObj
                ? ((supplierObj as SupplierRel)?.supplier_name ?? null)
                : null;

            const supplier_representative_id = repIsObj
                ? toNum((repObj as RepresentativeRel)?.id)
                : toNum(row.supplier_representative_id);

            const representative_name = repIsObj
                ? joinName([
                (repObj as RepresentativeRel)?.first_name,
                (repObj as RepresentativeRel)?.middle_name,
                (repObj as RepresentativeRel)?.last_name,
                (repObj as RepresentativeRel)?.suffix,
            ]) || null
                : null;

            const createdById = toNum(row?.created_by);
            const created_by_name = createdById
                ? userNameById.get(createdById) ?? `User #${createdById}`
                : null;

            return {
                id: row.id,
                transmittal_no: row.transmittal_no ?? null,
                status: row.status ?? null,
                created_at: row.created_at ?? null,

                created_by_id: createdById, // ✅ helpful for debugging
                created_by_name, // ✅ this should now show real name

                total_amount: row.total_amount ?? null,
                supplier_id,
                supplier_name,
                supplier_representative_id,
                representative_name,
            };
        });

        return NextResponse.json({ data }, { status: 200 });
    } catch (e: unknown) {
        const details =
            e && typeof e === "object" && "message" in e
                ? String((e as { message?: unknown }).message ?? e)
                : String(e);

        return NextResponse.json({ error: "Unexpected error", details }, { status: 500 });
    }
}