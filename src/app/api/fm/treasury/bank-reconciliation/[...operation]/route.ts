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
  const allowed = method === "GET" && (path === "master-options" || new RegExp(`^banks/${id}/(configuration|open-period)$|^periods/${id}(/ledger|/transactions)?$`).test(path))
    || method === "PUT" && new RegExp(`^banks/${id}/configuration$|^periods/${id}$`).test(path)
    || method === "POST" && (path === "periods" || /^masters\/(companies|accounts|bank-accounts)$/.test(path) || new RegExp(`^periods/${id}/(ledger/refresh|lines/(BANK|LEDGER))$`).test(path))
    || method === "DELETE" && new RegExp(`^periods/${id}/lines/(BANK|LEDGER)/${id}$`).test(path);
  if (!allowed) return NextResponse.json({ message: "Unknown Bank Reconciliation operation." }, { status: 404 });
  const query = request.nextUrl.searchParams.toString();
  const response = await proxySpring(`${ROOT}/${path}${query ? `?${query}` : ""}`, {
    method, ...(method !== "GET" ? { body: await request.text() } : {}), cache: "no-store",
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const DELETE = forward;
