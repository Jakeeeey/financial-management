import { NextRequest, NextResponse } from "next/server";
import { readPettyCash } from "../_spring";
import { masterListPdf, fundRecordPdf, cashCountPdf } from "./_print";
const id = "[1-9]\\d{0,17}";
export async function forwardMaster(request: NextRequest, workspace: "master-list" | "cash-count" | "onboarding-approval", parts: string[]) {
  const path = parts.join("/"), method = request.method, query = request.nextUrl.searchParams.toString(), tail = query ? `?${query}` : "";
  const validGet = workspace === "master-list" ? /^(summary|register|people|print|print-list)$/.test(path) || new RegExp(`^funds(?:/${id}(?:/(record|print))?)?$`).test(path) || new RegExp(`^counts/${id}/print$`).test(path)
    : workspace === "cash-count" ? /^(funds|denominations|people|counts)$/.test(path) || new RegExp(`^counts/${id}(?:/print)?$`).test(path)
      : path === "requests" || new RegExp(`^changes/${id}$`).test(path);
  const validPost = workspace === "master-list" ? new RegExp(`^funds/${id}/changes$`).test(path) : workspace === "cash-count" ? ["preview", "counts"].includes(path) : new RegExp(`^changes/${id}/(approve|reject)$`).test(path);
  if (!(method === "GET" ? validGet : method === "POST" && validPost)) return NextResponse.json({ code: "NOT_FOUND", message: "Unknown Petty Cash resource." }, { status: 404, headers: { "Cache-Control": "no-store" } });
  let body: string | undefined;
  if (method === "POST") { try { body = JSON.stringify(await request.json()); } catch { return NextResponse.json({ code: "INVALID_REQUEST", message: "Send a valid JSON document." }, { status: 400, headers: { "Cache-Control": "no-store" } }); } }
  const print = method === "GET" && (path === "print" || path.endsWith("/print"));
  const sourcePath = path === "print" ? "print-list" : path.startsWith("funds/") && path.endsWith("/print") ? path.replace(/\/print$/, "/record") : path.replace(/\/print$/, "");
  const source = await readPettyCash(`${workspace}/${sourcePath}${tail}`, { method, ...(body ? { body } : {}) });
  if (!print || !source.ok) return source;
  try {
    const data = await source.json(), bytes = path === "print" ? masterListPdf(data) : path.startsWith("funds/") ? fundRecordPdf(data) : cashCountPdf(data);
    const headers = new Headers(source.headers); headers.set("Content-Type", "application/pdf"); headers.set("Content-Disposition", `inline; filename="petty-cash-${path.replace(/[^a-zA-Z0-9_-]/g, "-")}.pdf"`); headers.set("Cache-Control", "private, no-store"); headers.set("X-Content-Type-Options", "nosniff"); headers.delete("Content-Length");
    return new NextResponse(Buffer.from(bytes), { headers });
  } catch { return NextResponse.json({ code: "FOUNDATION_UNAVAILABLE", message: "Unable to generate the Petty Cash document. Refresh and retry." }, { status: 503, headers: { "Cache-Control": "no-store" } }); }
}
