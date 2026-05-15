import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;
const COOKIE_NAME = "vos_access_token";

type LookupRow = Record<string, unknown>;

interface DirectusListResponse<T> {
    data?: T[];
}

/**
 * Converts Directus and query-string scalar values into a numeric ID.
 */
const toNumber = (value: unknown): number | null => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() !== "") {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
};

const toString = (value: unknown): string => typeof value === "string" ? value.trim() : "";

/**
 * Resolves a department ID from either a raw relation ID or an expanded Directus relation object.
 */
const getDepartmentId = (row: LookupRow): number | null => {
    const department = row.department_id ?? row.departmentId ?? row.department;

    if (department !== null && typeof department === "object" && !Array.isArray(department)) {
        const departmentRow = department as LookupRow;
        return toNumber(departmentRow.department_id ?? departmentRow.departmentId ?? departmentRow.id);
    }

    return toNumber(department);
};

/**
 * Resolves a department display name when the relationship row already contains expanded data.
 */
const getDepartmentName = (row: LookupRow): string => {
    const department = row.department_id ?? row.departmentId ?? row.department;

    if (department !== null && typeof department === "object" && !Array.isArray(department)) {
        const departmentRow = department as LookupRow;
        return toString(departmentRow.department_name ?? departmentRow.departmentName ?? departmentRow.name);
    }

    return toString(row.department_name ?? row.departmentName ?? row.name);
};

const directusHeaders = () => ({
    Authorization: `Bearer ${DIRECTUS_TOKEN}`,
});

/**
 * Returns departments linked to a division through the department_per_division table.
 */
export async function GET(request: NextRequest) {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;

    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    if (!DIRECTUS_URL || !DIRECTUS_TOKEN) {
        return NextResponse.json({ message: "Directus lookup is not configured" }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const divisionId = toNumber(searchParams.get("divisionId"));

    if (!divisionId) {
        return NextResponse.json({ message: "divisionId is required" }, { status: 400 });
    }

    try {
        const relationParams = new URLSearchParams({
            "filter[division_id][_eq]": String(divisionId),
            fields: "department_id",
            limit: "-1",
        });
        const relationRes = await fetch(`${DIRECTUS_URL}/items/department_per_division?${relationParams.toString()}`, {
            headers: directusHeaders(),
            cache: "no-store",
        });

        if (!relationRes.ok) throw new Error(await relationRes.text());

        const relationJson = await relationRes.json() as DirectusListResponse<LookupRow>;
        const relationRows = relationJson.data ?? [];
        const namedDepartments = relationRows
            .map((row) => ({
                id: getDepartmentId(row),
                departmentName: getDepartmentName(row),
            }))
            .filter((row): row is { id: number; departmentName: string } => row.id !== null && row.departmentName !== "");

        if (namedDepartments.length === relationRows.length) {
            return NextResponse.json({ data: namedDepartments });
        }

        const departmentIds = Array.from(new Set(relationRows.map(getDepartmentId).filter((id): id is number => id !== null)));
        if (departmentIds.length === 0) return NextResponse.json({ data: [] });

        const departmentParams = new URLSearchParams({
            "filter[department_id][_in]": departmentIds.join(","),
            fields: "department_id,department_name",
            limit: "-1",
            sort: "department_name",
        });
        const departmentRes = await fetch(`${DIRECTUS_URL}/items/department?${departmentParams.toString()}`, {
            headers: directusHeaders(),
            cache: "no-store",
        });

        if (!departmentRes.ok) throw new Error(await departmentRes.text());

        const departmentJson = await departmentRes.json() as DirectusListResponse<LookupRow>;
        const departments = (departmentJson.data ?? [])
            .map((row) => ({
                id: toNumber(row.department_id ?? row.departmentId ?? row.id),
                departmentName: toString(row.department_name ?? row.departmentName ?? row.name),
            }))
            .filter((row): row is { id: number; departmentName: string } => row.id !== null && row.departmentName !== "");

        return NextResponse.json({ data: departments });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error occurred";
        return NextResponse.json({ message: "Failed to fetch departments by division", detail: message }, { status: 502 });
    }
}
