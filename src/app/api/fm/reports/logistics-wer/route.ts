import { NextRequest, NextResponse } from "next/server";
import { getDispatchPlans } from "./_directus";
import type { LogisticsWerReportPage } from "@/modules/financial-management/reports/logistics-wer/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function currentManilaWeek() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const today = new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day)));
  const mondayOffset = (today.getUTCDay() + 6) % 7;
  const start = new Date(today);
  start.setUTCDate(start.getUTCDate() - mondayOffset);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  return { startDate: dateOnly(start), endDate: dateOnly(end) };
}

function isValidDateOnly(value: string): boolean {
  if (!DATE_ONLY_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && dateOnly(parsed) === value;
}

function normalizePage(value: string | null): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
}

function normalizeSize(value: string | null): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 25;
  return Math.min(100, Math.floor(parsed));
}

export async function GET(request: NextRequest) {
  const defaults = currentManilaWeek();
  const startDate = request.nextUrl.searchParams.get("startDate") || defaults.startDate;
  const endDate = request.nextUrl.searchParams.get("endDate") || defaults.endDate;

  if (!isValidDateOnly(startDate) || !isValidDateOnly(endDate)) {
    return NextResponse.json(
      { message: "startDate and endDate must use the YYYY-MM-DD format and contain valid dates." },
      { status: 400 },
    );
  }

  if (startDate > endDate) {
    return NextResponse.json(
      { message: "startDate must be on or before endDate." },
      { status: 400 },
    );
  }

  const search = request.nextUrl.searchParams.get("search")?.trim().toLowerCase() || "";
  const status = request.nextUrl.searchParams.get("status")?.trim() || "ALL";
  const page = normalizePage(request.nextUrl.searchParams.get("page"));
  const size = normalizeSize(request.nextUrl.searchParams.get("size"));

  try {
    const result = await getDispatchPlans({ startDate, endDate, status, search, page, size });
    const response: LogisticsWerReportPage = {
      content: result.content,
      number: page,
      size,
      totalElements: result.totalElements,
      totalPages: result.totalElements === 0 ? 0 : Math.ceil(result.totalElements / size),
      range: { startDate, endDate },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[Logistics WER] Failed to load report:", error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unable to load Logistics WER." },
      { status: 502 },
    );
  }
}
