import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { proxySpring } from "@/app/api/fm/financial-statements/adjusting-journal-entries/_spring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const ROOT = "/api/v1/treasury/bank-reconciliation";
const id = "[1-9]\\d{0,17}";

async function forward(request: NextRequest, { params }: { params: Promise<{ operation: string[] }> }) {
  const { operation } = await params;
  const path = operation.join("/");
  const method = request.method;
  const allowed = method === "GET" && (path === "master-options" || path === "periods" || new RegExp(`^banks/${id}/(configuration|open-period|posting-period)$|^periods/${id}(/ledger|/transactions|/posting)?$|^periods/${id}/(posting-requests|lifecycle-requests)/[0-9a-f-]{36}$|^periods/${id}/journals/${id}/gl-candidates$`).test(path))
    || method === "PUT" && new RegExp(`^banks/${id}/configuration$|^periods/${id}$|^periods/${id}/(posting-date|matches/${id}/offset-account|lines/BANK/${id}/(treatment|offset-account))$`).test(path)
    || method === "POST" && (path === "periods" || /^masters\/(companies|accounts|bank-accounts)$/.test(path) || new RegExp(`^periods/${id}/(close|reopen|next-period|ledger/refresh|lines/(BANK|LEDGER)|matches(/auto|/undo)?|posting/(post|reverse|retry|prepare-export|verify-import|withdraw))$`).test(path))
    || method === "DELETE" && new RegExp(`^periods/${id}/(lines/(BANK|LEDGER)/${id}|matches/${id})$`).test(path);
  if (!allowed) return NextResponse.json({ message: "Unknown Bank Reconciliation operation." }, { status: 404 });
  const query = request.nextUrl.searchParams.toString();
  const response = await proxySpring(`${ROOT}/${path}${query ? `?${query}` : ""}`, {
    method, ...(method !== "GET" ? { body: await request.text() } : {}), cache: "no-store",
  }, undefined, /\/matches\/auto$|\/posting\/|\/(close|reopen|next-period)$/.test(path) ? 60000 : undefined);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const DELETE = forward;
