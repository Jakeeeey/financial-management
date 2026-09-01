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
const STALE_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const PSGC_TIMEOUT_MS = 10_000;
const PSGC_MAX_ATTEMPTS = 2;
const PSGC_RETRY_DELAY_MS = 250;
const psgcCache = new Map<string, { expiresAt: number; staleUntil: number; data: PsgcRow[] }>();

class PsgcUpstreamError extends Error {
  constructor() {
    super("The address directory is temporarily unavailable. Please retry.");
    this.name = "PsgcUpstreamError";
  }
}

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

  for (let attempt = 0; attempt < PSGC_MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PSGC_TIMEOUT_MS);

    try {
      const res = await fetch(`${PSGC_BASE_URL}${path}`, {
        headers: { Accept: "application/json" },
        next: { revalidate: 86400 },
        signal: controller.signal,
      });

      if (!res.ok) throw new PsgcUpstreamError();

      const data = (await res.json()) as PsgcRow[];
      const now = Date.now();
      psgcCache.set(path, {
        data,
        expiresAt: now + CACHE_TTL_MS,
        staleUntil: now + STALE_CACHE_TTL_MS,
      });
      return data;
    } catch (error) {
      if (attempt === PSGC_MAX_ATTEMPTS - 1 && cached && cached.staleUntil > Date.now()) {
        psgcCache.set(path, {
          ...cached,
          expiresAt: Date.now() + PSGC_RETRY_DELAY_MS * 4,
        });
        return cached.data;
      }

      if (attempt === PSGC_MAX_ATTEMPTS - 1) {
        throw error instanceof PsgcUpstreamError ? error : new PsgcUpstreamError();
      }

      await new Promise((resolve) => setTimeout(resolve, PSGC_RETRY_DELAY_MS));
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw new PsgcUpstreamError();
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
    const isUpstreamError = error instanceof PsgcUpstreamError;
    return NextResponse.json(
      {
        code: isUpstreamError ? "PSGC_UNAVAILABLE" : "PSGC_LOOKUP_FAILED",
        retryable: isUpstreamError,
        error: error instanceof Error ? error.message : "Failed to load PSGC address data",
      },
      { status: isUpstreamError ? 503 : 500 },
    );
  }
}
