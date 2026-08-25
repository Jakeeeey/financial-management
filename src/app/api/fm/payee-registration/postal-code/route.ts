// src/app/api/fm/payee-registration/postal-code/route.ts
import JSZip from "jszip";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PostalCodeRecord = {
  zipcode: string;
  place: string;
  state: string;
  province: string;
  community: string;
};

type PostalCodeOption = {
  postalCode: string;
  placeName: string;
  provinceName?: string;
};

const POSTAL_CODE_DATASET_URL =
  "https://raw.githubusercontent.com/zauberware/postal-codes-json-xml-csv/master/data/PH.zip";
const POSTAL_CODE_JSON_FILE = "zipcodes.ph.json";
const CACHE_TTL_MS = 1000 * 60 * 60 * 24;

let postalDatasetCache: {
  expiresAt: number;
  records: PostalCodeRecord[];
} | null = null;

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b(city of|municipality of|province of)\b/gi, " ")
    .replace(/\b(city|municipality|province|barangay|brgy)\b/gi, " ")
    .replace(/\b(formerly|inc|cpo|po box|p\.o\. box)\b/gi, " ")
    .replace(/[^a-z0-9]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function containsName(value: string, query: string) {
  const normalizedValue = normalizeName(value);
  const normalizedQuery = normalizeName(query);

  return (
    Boolean(normalizedValue) &&
    Boolean(normalizedQuery) &&
    (normalizedValue === normalizedQuery ||
      normalizedValue.includes(normalizedQuery) ||
      normalizedQuery.includes(normalizedValue))
  );
}

function provinceAliases(province: string) {
  const normalizedProvince = normalizeName(province);

  if (
    normalizedProvince === "metro manila" ||
    normalizedProvince === "metropolitan manila" ||
    normalizedProvince === "national capital region" ||
    normalizedProvince === "ncr"
  ) {
    return ["Metro Manila", "Metropolitan Manila", "National Capital Region", "NCR"];
  }

  return province ? [province] : [];
}

function recordMatchesProvince(record: PostalCodeRecord, province: string) {
  const aliases = provinceAliases(province);
  if (aliases.length === 0) return true;

  return aliases.some(
    (alias) =>
      containsName(record.province, alias) ||
      containsName(record.state, alias) ||
      containsName(record.community, alias),
  );
}

function recordMatchesCity(record: PostalCodeRecord, city: string) {
  return containsName(record.place, city) || containsName(record.community, city);
}

function barangayScore(record: PostalCodeRecord, barangay: string) {
  if (!barangay) return 4;
  if (normalizeName(record.place) === normalizeName(barangay)) return 0;
  if (normalizeName(record.community) === normalizeName(barangay)) return 1;
  if (containsName(record.place, barangay)) return 2;
  if (containsName(record.community, barangay)) return 3;
  return 4;
}

function recordScore(record: PostalCodeRecord, city: string, barangay: string) {
  const barangayMatch = barangayScore(record, barangay);
  if (barangayMatch < 4) return barangayMatch;
  if (normalizeName(record.place) === normalizeName(city)) return 5;
  if (normalizeName(record.community) === normalizeName(city)) return 6;
  if (containsName(record.place, city)) return 7;
  if (containsName(record.community, city)) return 8;
  return 9;
}

function dedupeOptions(
  records: PostalCodeRecord[],
  city: string,
  barangay: string,
) {
  const byPostalCode = new Map<string, PostalCodeRecord>();

  for (const record of records) {
    const existing = byPostalCode.get(record.zipcode);
    if (!existing || recordScore(record, city, barangay) < recordScore(existing, city, barangay)) {
      byPostalCode.set(record.zipcode, record);
    }
  }

  return Array.from(byPostalCode.values())
    .sort((first, second) => {
      const scoreDiff = recordScore(first, city, barangay) - recordScore(second, city, barangay);
      if (scoreDiff !== 0) return scoreDiff;
      return first.zipcode.localeCompare(second.zipcode);
    })
    .map((record) => ({
      postalCode: record.zipcode,
      placeName: record.place || record.community || city,
      provinceName: record.province || record.state || undefined,
    }));
}

async function loadPostalCodeRecords() {
  if (postalDatasetCache && postalDatasetCache.expiresAt > Date.now()) {
    return postalDatasetCache.records;
  }

  const response = await fetch(POSTAL_CODE_DATASET_URL, {
    headers: { Accept: "application/zip" },
    next: { revalidate: 86400 },
  });

  if (!response.ok) {
    throw new Error(`Postal code dataset request failed (${response.status})`);
  }

  const zip = await JSZip.loadAsync(Buffer.from(await response.arrayBuffer()));
  const jsonFile = zip.file(POSTAL_CODE_JSON_FILE);
  if (!jsonFile) throw new Error("Postal code dataset is missing PH JSON data");

  const rows = JSON.parse(await jsonFile.async("string")) as unknown[];
  const records = rows
    .map((row) => {
      const record = row as Record<string, unknown>;
      return {
        zipcode: asString(record.zipcode),
        place: asString(record.place),
        state: asString(record.state),
        province: asString(record.province),
        community: asString(record.community),
      };
    })
    .filter((record) => record.zipcode && (record.place || record.community));

  postalDatasetCache = {
    records,
    expiresAt: Date.now() + CACHE_TTL_MS,
  };

  return records;
}

function findPostalCodeOptions(
  records: PostalCodeRecord[],
  province: string,
  city: string,
  barangay: string,
): PostalCodeOption[] {
  const cityMatches = records.filter(
    (record) =>
      recordMatchesCity(record, city) &&
      recordMatchesProvince(record, province),
  );

  if (!barangay) return dedupeOptions(cityMatches, city, barangay);

  const barangayMatches = cityMatches.filter(
    (record) => barangayScore(record, barangay) < 4,
  );

  return dedupeOptions(
    barangayMatches.length > 0 ? barangayMatches : cityMatches,
    city,
    barangay,
  );
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const province = asString(searchParams.get("province"));
    const city = asString(searchParams.get("city"));
    const barangay = asString(searchParams.get("barangay"));

    if (!city) {
      return NextResponse.json({ options: [] });
    }

    const records = await loadPostalCodeRecords();

    return NextResponse.json({
      options: findPostalCodeOptions(records, province, city, barangay),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load postal code suggestions",
      },
      { status: 500 },
    );
  }
}
