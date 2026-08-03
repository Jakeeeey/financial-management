import { NextRequest, NextResponse } from "next/server";
import { proxySpring } from "@/app/api/fm/financial-statements/adjusting-journal-entries/_spring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MANILA_TIME_ZONE = "Asia/Manila";
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ALL_INVOICE_START_DATE = "1000-01-01";
const ALL_INVOICE_END_DATE = "9999-12-31";

interface UpstreamRecord {
  invoiceId?: unknown;
  invoiceNo?: unknown;
  orderId?: unknown;
  customerName?: unknown;
  customerCode?: unknown;
  invoiceDate?: unknown;
  calculatedDueDate?: unknown;
  grossAmount?: unknown;
  discountAmount?: unknown;
  returnAmount?: unknown;
  netReceivable?: unknown;
  unfulfilledAmount?: unknown;
  appliedCreditMemos?: unknown;
  appliedDebitMemos?: unknown;
  totalPaid?: unknown;
  outstandingBalance?: unknown;
  daysOverdue?: unknown;
  branch?: unknown;
  division?: unknown;
  salesman?: unknown;
  isPosted?: unknown;
}

function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function manilaToday(): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: MANILA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return new Date(Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
  ));
}

function currentManilaWeek() {
  const today = manilaToday();
  const mondayOffset = (today.getUTCDay() + 6) % 7;
  const start = new Date(today.getTime());
  start.setUTCDate(start.getUTCDate() - mondayOffset);
  const end = new Date(start.getTime());
  end.setUTCDate(end.getUTCDate() + 6);

  return { startDate: dateOnly(start), endDate: dateOnly(end) };
}

function parseDateOnly(value: string): Date | null {
  if (!DATE_ONLY_PATTERN.test(value)) return null;

  const date = new Date(`${value}T00:00:00.000Z`);
  return date.toISOString().slice(0, 10) === value ? date : null;
}

function toManilaDateOnly(value: unknown): string {
  if (typeof value !== "string" && typeof value !== "number") return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: MANILA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${values.year}-${values.month}-${values.day}`;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asNullableString(value: unknown): string | null {
  const normalized = asString(value);
  return normalized || null;
}

function asNumber(value: unknown): number {
  const normalized = Number(value ?? 0);
  return Number.isFinite(normalized) ? normalized : 0;
}

function asNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;

  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : null;
}

function normalizeRecords(payload: unknown) {
  if (!Array.isArray(payload)) return null;

  return payload.map((value): {
    invoiceId: number;
    invoiceNo: string;
    orderId: string | null;
    customerName: string;
    customerCode: string;
    invoiceDate: string;
    dueDate: string;
    grossAmount: number | null;
    discountAmount: number | null;
    returnAmount: number | null;
    netReceivable: number | null;
    unfulfilledAmount: number | null;
    appliedCreditMemos: number | null;
    appliedDebitMemos: number | null;
    totalPaid: number | null;
    outstandingBalance: number;
    daysOverdue: number | null;
    branch: string | null;
    division: string | null;
    salesman: string | null;
    isPosted: number | null;
  } => {
    const row = (value && typeof value === "object" ? value : {}) as UpstreamRecord;
    const invoiceId = Number(row.invoiceId);

    return {
      invoiceId: Number.isFinite(invoiceId) ? invoiceId : 0,
      invoiceNo: asString(row.invoiceNo),
      orderId: asNullableString(row.orderId),
      customerName: asString(row.customerName),
      customerCode: asString(row.customerCode),
      invoiceDate: toManilaDateOnly(row.invoiceDate),
      dueDate: toManilaDateOnly(row.calculatedDueDate),
      grossAmount: asNullableNumber(row.grossAmount),
      discountAmount: asNullableNumber(row.discountAmount),
      returnAmount: asNullableNumber(row.returnAmount),
      netReceivable: asNullableNumber(row.netReceivable),
      unfulfilledAmount: asNullableNumber(row.unfulfilledAmount),
      appliedCreditMemos: asNullableNumber(row.appliedCreditMemos),
      appliedDebitMemos: asNullableNumber(row.appliedDebitMemos),
      totalPaid: asNullableNumber(row.totalPaid),
      outstandingBalance: asNumber(row.outstandingBalance),
      daysOverdue: asNullableNumber(row.daysOverdue),
      branch: asNullableString(row.branch),
      division: asNullableString(row.division),
      salesman: asNullableString(row.salesman),
      isPosted: asNullableNumber(row.isPosted),
    };
  });
}

function copySetCookies(source: NextResponse, target: NextResponse) {
  for (const cookie of source.headers.getSetCookie()) {
    target.headers.append("set-cookie", cookie);
  }
}

export async function GET(request: NextRequest) {
  const allInvoices = request.nextUrl.searchParams.get("all") === "true";
  const queryStart = request.nextUrl.searchParams.get("startDate");
  const queryEnd = request.nextUrl.searchParams.get("endDate");
  const defaults = currentManilaWeek();
  const startDate = allInvoices ? ALL_INVOICE_START_DATE : queryStart || defaults.startDate;
  const endDate = allInvoices ? ALL_INVOICE_END_DATE : queryEnd || defaults.endDate;
  const start = parseDateOnly(startDate);
  const end = parseDateOnly(endDate);

  if (!start || !end) {
    return NextResponse.json(
      { message: "startDate and endDate must use the YYYY-MM-DD format and contain valid dates." },
      { status: 400 },
    );
  }

  if (start.getTime() > end.getTime()) {
    return NextResponse.json(
      { message: "startDate must be on or before endDate." },
      { status: 400 },
    );
  }

  const params = new URLSearchParams({ startDate, endDate });
  const springResponse = await proxySpring(`/api/v1/accounts-receivable?${params.toString()}`);

  if (!springResponse.ok) return springResponse;

  const payload = await springResponse.json().catch(() => null);
  const records = normalizeRecords(payload);

  if (!records) {
    const response = NextResponse.json(
      { message: "The accounts receivable service returned an invalid response." },
      { status: 502 },
    );
    copySetCookies(springResponse, response);
    return response;
  }

  const response = NextResponse.json({
    range: allInvoices ? null : { startDate, endDate },
    allInvoices,
    records,
  });
  copySetCookies(springResponse, response);
  return response;
}
