import type { AdjustingEntry, AjeAccess, AjePrintReport } from "@/modules/financial-management/financial-statements/adjusting-journal-entries/types";
import { proxySpring, refreshedAccessToken } from "./_spring";

export const AJE_RESOURCE = "/api/financial-statements/adjusting-journal-entries";
export type SpringReader = (path: string, init?: RequestInit, token?: string) => Promise<Response>;
type PrintContext = { cookies: string[]; token?: string };

export class AjePrintError extends Error {
  constructor(message: string, public status = 502, public cookies: string[] = []) { super(message); }
}

export function reportPrintParams(query: URLSearchParams) {
  const allowed = ["search", "status", "queue", "startDate", "endDate", "divisionId", "departmentId", "accountTypeId", "sourceJeNo", "sort"];
  const result = new URLSearchParams({ format: "json" });
  for (const key of allowed) {
    const value = query.get(key);
    if (value && value !== "All") result.set(key, value);
  }
  if (!result.has("sort")) result.set("sort", "lastActivity,desc");
  return result;
}

async function read(path: string, context: PrintContext, spring: SpringReader): Promise<unknown> {
  let response: Response;
  try { response = await spring(path, undefined, context.token); }
  catch { throw new AjePrintError("The journal service is unavailable. Please try again.", 502, context.cookies); }
  context.cookies.push(...response.headers.getSetCookie());
  context.token = refreshedAccessToken(response) || context.token;
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new AjePrintError(error?.message || "Unable to load the requested adjusting entries.", response.status, context.cookies);
  }
  if (!response.headers.get("content-type")?.includes("application/json")) {
    throw new AjePrintError("JSON report output is unavailable. Update ERP_SERVER before using summary PDFs.", 503, context.cookies);
  }
  try { return await response.json(); }
  catch { throw new AjePrintError("The journal service returned an incomplete response. No PDF was generated.", 502, context.cookies); }
}

function isActor(value: unknown): value is AjeAccess {
  const actor = value as AjeAccess | null;
  return Boolean(actor && Number.isSafeInteger(actor.userId) && actor.userId > 0 && typeof actor.userName === "string");
}
function isEntry(value: unknown): value is AdjustingEntry {
  const entry = value as AdjustingEntry | null;
  return Boolean(entry && Number.isSafeInteger(entry.id) && entry.id > 0 && typeof entry.status === "string"
    && typeof entry.transactionDate === "string" && typeof entry.totalDebit === "number" && Number.isFinite(entry.totalDebit)
    && typeof entry.totalCredit === "number" && Number.isFinite(entry.totalCredit));
}
const decimal = (value: unknown) => typeof value === "string" && /^-?\d+(?:\.\d+)?$/.test(value);

export async function loadEntryPrint(id: string, spring: SpringReader = proxySpring) {
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) throw new AjePrintError("Invalid adjustment ID.", 400);
  const context: PrintContext = { cookies: [] };
  const entry = await read(AJE_RESOURCE + "/" + id, context, spring);
  if (!isEntry(entry) || entry.id !== Number(id) || !Array.isArray(entry.details)) {
    throw new AjePrintError("The journal service returned invalid adjustment details.", 502, context.cookies);
  }
  const actor = await read(AJE_RESOURCE + "/access", context, spring);
  if (!isActor(actor)) throw new AjePrintError("Unable to verify the user generating this PDF.", 502, context.cookies);
  return { entry, actor, cookies: context.cookies, generatedAt: new Date().toISOString() };
}

export async function loadSummaryPrint(query: URLSearchParams, spring: SpringReader = proxySpring) {
  const context: PrintContext = { cookies: [] };
  const params = reportPrintParams(query);
  const report = await read(AJE_RESOURCE + "/report?" + params, context, spring) as AjePrintReport;
  if (!report || !Array.isArray(report.entries) || !report.entries.every(isEntry)
    || !Number.isSafeInteger(report.totalRecords) || report.totalRecords !== report.entries.length
    || new Set(report.entries.map(entry => entry.id)).size !== report.totalRecords
    || !decimal(report.totalDebit) || !decimal(report.totalCredit) || !isActor(report.generatedBy)
    || typeof report.generatedAt !== "string" || !Number.isFinite(Date.parse(report.generatedAt))) {
    throw new AjePrintError("The journal service returned an incomplete or invalid summary. No PDF was generated.", 502, context.cookies);
  }
  return { report, params, cookies: context.cookies };
}

export function printMoney(value: number | string) {
  if (typeof value === "number") return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(value);
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(value);
  if (!match) throw new AjePrintError("The report contains an invalid monetary value.");
  const fraction = (match[3] || "").padEnd(3, "0");
  const cents = BigInt(match[2]) * 100n + BigInt(fraction.slice(0, 2)) + (fraction[2] >= "5" ? 1n : 0n);
  return (match[1] && cents !== 0n ? "-" : "") + "₱" + (cents / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")
    + "." + (cents % 100n).toString().padStart(2, "0");
}
