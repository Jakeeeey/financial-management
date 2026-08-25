// src/app/api/fm/treasury/bank-management/account-management/psgc/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PsgcKind = "provinces" | "cities" | "barangays";

type PsgcRow = {
  code?: unknown;
  name?: unknown;
  provinceCode?: unknown;
  cityCode?: unknown;
  municipalityCode?: unknown;
  cityMunicipalityCode?: unknown;
  subMunicipalityCode?: unknown;
};

type PsgcOption = {
  code: string;
  name: string;
  provinceCode?: string;
  cityCode?: string;
};

const PSGC_BASE_URL = "https://psgc.gitlab.io/api";
const CACHE_TTL_MS = 1000 * 60 * 60 * 24;
const psgcCache = new Map<string, { expiresAt: number; data: PsgcRow[] }>();

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asCode(value: unknown) {
  const text = asString(value);
  return text ? text : undefined;
}

function deriveCityCodeFromBarangayCode(code: string) {
  return code.length >= 6 ? `${code.slice(0, 6)}000` : undefined;
}

function normalizeProvince(row: PsgcRow): PsgcOption | null {
  const code = asCode(row.code);
  const name = asString(row.name);
  return code && name ? { code, name } : null;
}

function normalizeCity(row: PsgcRow): PsgcOption | null {
  const code = asCode(row.code);
  const name = asString(row.name);
  if (!code || !name) return null;

  return {
    code,
    name,
    provinceCode: asCode(row.provinceCode),
  };
}

function normalizeBarangay(row: PsgcRow): PsgcOption | null {
  const code = asCode(row.code);
  const name = asString(row.name);
  if (!code || !name) return null;

  return {
    code,
    name,
    provinceCode: asCode(row.provinceCode),
    cityCode:
      asCode(row.cityMunicipalityCode) ??
      asCode(row.cityCode) ??
      asCode(row.municipalityCode) ??
      asCode(row.subMunicipalityCode) ??
      deriveCityCodeFromBarangayCode(code),
  };
}

function normalizeRows(kind: PsgcKind, rows: PsgcRow[]) {
  const normalizer =
    kind === "provinces"
      ? normalizeProvince
      : kind === "cities"
        ? normalizeCity
        : normalizeBarangay;

  return rows
    .map(normalizer)
    .filter((row): row is PsgcOption => Boolean(row))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function fetchPsgc(path: string) {
  const cached = psgcCache.get(path);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const res = await fetch(`${PSGC_BASE_URL}${path}`, {
    headers: { Accept: "application/json" },
    next: { revalidate: 86400 },
  });

  if (!res.ok) {
    throw new Error(`PSGC request failed (${res.status})`);
  }

  const data = (await res.json()) as PsgcRow[];
  psgcCache.set(path, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  return data;
}

function buildPath(kind: PsgcKind, searchParams: URLSearchParams) {
  const provinceCode = asString(searchParams.get("province_code"));
  const cityCode = asString(searchParams.get("city_code"));

  if (kind === "provinces") return "/provinces.json";
  if (kind === "cities") {
    return provinceCode
      ? `/provinces/${encodeURIComponent(provinceCode)}/cities-municipalities.json`
      : "/cities-municipalities.json";
  }

  if (cityCode) {
    return `/cities-municipalities/${encodeURIComponent(cityCode)}/barangays.json`;
  }

  if (provinceCode) {
    return `/provinces/${encodeURIComponent(provinceCode)}/barangays.json`;
  }

  return "/barangays.json";
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const kind = searchParams.get("kind") as PsgcKind | null;

    if (kind !== "provinces" && kind !== "cities" && kind !== "barangays") {
      return NextResponse.json({ error: "Invalid PSGC kind" }, { status: 400 });
    }

    const rows = await fetchPsgc(buildPath(kind, searchParams));
    return NextResponse.json({ options: normalizeRows(kind, rows) });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load PSGC address data",
      },
      { status: 500 },
    );
  }
}
