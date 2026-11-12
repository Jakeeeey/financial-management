import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIRECTUS_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "").trim().replace(/\/$/, "");
const DIRECTUS_STATIC_TOKEN = (process.env.DIRECTUS_STATIC_TOKEN || "").trim();

const EMPTY_PROFILE = {
    companyName: null,
    address: null,
    tin: null,
    logoDataUrl: null,
} as const;

type DirectusAssetValue = string | { id?: string | null } | null;

interface DirectusCompany {
    company_name?: string | null;
    company_address?: string | null;
    company_brgy?: string | null;
    company_city?: string | null;
    company_province?: string | null;
    company_zipCode?: string | null;
    company_tin?: string | null;
    company_logo?: DirectusAssetValue;
}

function asNullableString(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed || null;
}

function joinAddress(company: DirectusCompany): string | null {
    const parts = [
        company.company_address,
        company.company_brgy,
        company.company_city,
        company.company_province,
        company.company_zipCode,
    ]
        .map(asNullableString)
        .filter((value): value is string => Boolean(value));

    return parts.length > 0 ? parts.join(", ") : null;
}

function getAssetId(value: DirectusAssetValue): string | null {
    if (typeof value === "string") return asNullableString(value);
    if (value && typeof value.id === "string") return asNullableString(value.id);
    return null;
}

async function getLogoDataUrl(value: DirectusAssetValue): Promise<string | null> {
    const assetId = getAssetId(value);
    if (!assetId) return null;
    if (assetId.startsWith("data:image/")) return assetId;

    try {
        const response = await fetch(
            `${DIRECTUS_URL}/assets/${encodeURIComponent(assetId)}`,
            {
                headers: { Authorization: `Bearer ${DIRECTUS_STATIC_TOKEN}` },
                cache: "no-store",
            },
        );

        if (!response.ok) return null;

        const contentType = response.headers.get("content-type") || "image/png";
        if (!contentType.toLowerCase().startsWith("image/")) return null;

        const buffer = Buffer.from(await response.arrayBuffer());
        return `data:${contentType};base64,${buffer.toString("base64")}`;
    } catch {
        return null;
    }
}

export async function GET() {
    const token = (await cookies()).get("vos_access_token")?.value;
    if (!token) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    if (!DIRECTUS_URL || !DIRECTUS_STATIC_TOKEN) {
        return NextResponse.json(
            { error: "Company profile service is not configured." },
            { status: 500 },
        );
    }

    try {
        const params = new URLSearchParams({
            "filter[company_id][_eq]": "1",
            fields: "company_name,company_address,company_brgy,company_city,company_province,company_zipCode,company_tin,company_logo",
            limit: "1",
        });
        const response = await fetch(`${DIRECTUS_URL}/items/company?${params.toString()}`, {
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${DIRECTUS_STATIC_TOKEN}`,
            },
            cache: "no-store",
        });

        if (!response.ok) {
            return NextResponse.json(
                { error: "Unable to load the company profile." },
                { status: 502 },
            );
        }

        const payload = await response.json() as { data?: DirectusCompany[] };
        const company = Array.isArray(payload.data) ? payload.data[0] : undefined;
        if (!company) {
            return NextResponse.json({ data: EMPTY_PROFILE }, { status: 200 });
        }

        return NextResponse.json({
            data: {
                companyName: asNullableString(company.company_name),
                address: joinAddress(company),
                tin: asNullableString(company.company_tin),
                logoDataUrl: await getLogoDataUrl(company.company_logo ?? null),
            },
        });
    } catch {
        return NextResponse.json(
            { error: "Unable to load the company profile." },
            { status: 502 },
        );
    }
}
