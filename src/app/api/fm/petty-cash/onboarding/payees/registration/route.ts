import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readPettyCash } from "../../../_spring";
import { requirePayeeRegistrationAccess } from "@/app/api/fm/payee-registration/_access";
import { createPayee } from "@/modules/financial-management/payee-registration/services/payee";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const schema = z.object({
  supplierName: z.string().trim().min(2).max(255),
  tin: z.string().trim().max(30).transform(value => value.replace(/[\s-]/g, "")),
  payeeKind: z.enum(["INDIVIDUAL", "CORPORATION"]), vatRegistered: z.boolean(),
}).superRefine((value, ctx) => {
  if (value.tin && !/^\d{9,12}$/.test(value.tin)) ctx.addIssue({ code: "custom", path: ["tin"], message: "Enter a valid 9–12 digit TIN." });
  if (value.vatRegistered && !value.tin) ctx.addIssue({ code: "custom", path: ["tin"], message: "A VAT-registered payee requires a TIN." });
});
export async function POST(request: NextRequest) {
  const permission = await readPettyCash("workspaces/onboarding");
  if (!permission.ok) return permission;
  const access = await requirePayeeRegistrationAccess();
  const requestId = crypto.randomUUID();
  const respond = (body: object, status: number) => {
    const response = NextResponse.json({ ...body, requestId }, { status, headers: { "Cache-Control": "no-store" } });
    for (const cookie of permission.headers.getSetCookie()) response.headers.append("Set-Cookie", cookie);
    return response;
  };
  if (!access.ok) return respond({ code: "ACCESS_DENIED", message: access.message }, access.status);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return respond({ code: "VALIDATION_FAILED", message: "Check the highlighted fields.", fieldErrors: Object.fromEntries(parsed.error.issues.map(issue => [issue.path.join("."), issue.message])) }, 400);
  try {
    const value = parsed.data;
    const base = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");
    const filter = { _or: [{ supplier_name: { _eq: value.supplierName } }, ...(value.tin ? [{ tin_number: { _eq: value.tin } }] : [])] };
    const params = new URLSearchParams({ filter: JSON.stringify(filter), fields: "id,supplier_name,isActive", limit: "10" });
    const existing = await fetch(`${base}/items/suppliers?${params}`, { headers: { Authorization: `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}` }, cache: "no-store" });
    if (!existing.ok) return respond({ code: "FOUNDATION_UNAVAILABLE", message: "Unable to verify the shared payee registry. Please retry." }, 503);
    const payload = await existing.json() as { data?: Array<{ id: number }> };
    if (payload.data?.length) return respond({ code: "CONFLICT", message: "A shared payee with this name or TIN already exists. Link the existing record instead.", existingSupplierId: payload.data[0].id }, 409);
    const payee = await createPayee({ supplier_name: value.supplierName, supplier_type: "NON-TRADE", ...(value.tin ? { tin_number: value.tin } : {}), isActive: 1, date_added: new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }) });
    return respond({ supplierId: payee.id, supplierName: payee.supplier_name, message: "Shared payee registered. Finish Petty Cash profile setup." }, 201);
  } catch {
    return respond({ code: "FOUNDATION_UNAVAILABLE", message: "The shared registration outcome could not be confirmed. Search the payee registry before trying registration again." }, 503);
  }
}
