import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readPettyCash } from "../../../../_spring";
import { updatePayee } from "@/modules/financial-management/payee-registration/services/payee";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ supplierId: string }> };

const schema = z.object({
  supplierName: z.string().trim().min(2, "Enter a payee name.").max(255, "Use at most 255 characters."),
  tin: z.string().trim().max(30, "Use at most 30 characters.").transform(value => value.replace(/[\s-]/g, "")),
}).superRefine((value, context) => {
  if (value.tin && !/^\d{9,12}$/.test(value.tin)) {
    context.addIssue({ code: "custom", path: ["tin"], message: "Enter a valid 9–12 digit TIN, or leave it blank." });
  }
});

export async function PATCH(request: NextRequest, { params }: Context) {
  const permission = await readPettyCash("workspaces/onboarding");
  if (!permission.ok) return permission;

  const requestId = crypto.randomUUID();
  const respond = (body: object, status: number) => {
    const response = NextResponse.json({ ...body, requestId }, { status, headers: { "Cache-Control": "no-store" } });
    for (const cookie of permission.headers.getSetCookie()) response.headers.append("Set-Cookie", cookie);
    return response;
  };

  const { supplierId: rawSupplierId } = await params;
  if (!/^[1-9]\d{0,17}$/.test(rawSupplierId)) {
    return respond({ code: "INVALID_REQUEST", message: "Select a valid payee." }, 400);
  }
  const supplierId = Number(rawSupplierId);
  if (!Number.isSafeInteger(supplierId)) {
    return respond({ code: "INVALID_REQUEST", message: "Select a valid payee." }, 400);
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return respond({
      code: "VALIDATION_FAILED",
      message: "Check the highlighted fields.",
      fieldErrors: Object.fromEntries(parsed.error.issues.map(issue => [issue.path.join("."), issue.message])),
    }, 400);
  }

  const base = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");
  const token = process.env.DIRECTUS_STATIC_TOKEN;
  if (!base || !token) {
    return respond({ code: "FOUNDATION_UNAVAILABLE", message: "The shared payee registry is unavailable. Please retry." }, 503);
  }

  const headers = { Authorization: `Bearer ${token}` };
  try {
    const target = await fetch(`${base}/items/suppliers/${supplierId}?fields=id`, { headers, cache: "no-store" });
    if (target.status === 404) return respond({ code: "NOT_FOUND", message: "The linked supplier no longer exists. Reload the payee list." }, 404);
    if (!target.ok) return respond({ code: "FOUNDATION_UNAVAILABLE", message: "Unable to verify the shared payee. Please retry." }, 503);

    const value = parsed.data;
    const filter = {
      _and: [
        { id: { _neq: supplierId } },
        { _or: [
          { supplier_name: { _eq: value.supplierName } },
          ...(value.tin ? [{ tin_number: { _eq: value.tin } }] : []),
        ] },
      ],
    };
    const query = new URLSearchParams({ filter: JSON.stringify(filter), fields: "id,supplier_name,tin_number", limit: "10" });
    const conflictsResponse = await fetch(`${base}/items/suppliers?${query}`, { headers, cache: "no-store" });
    if (!conflictsResponse.ok) return respond({ code: "FOUNDATION_UNAVAILABLE", message: "Unable to verify the shared payee registry. Please retry." }, 503);

    const conflicts = (await conflictsResponse.json().catch(() => null) as { data?: Array<{ supplier_name?: string | null; tin_number?: string | null }> } | null)?.data || [];
    const nameConflict = conflicts.some(item => item.supplier_name?.trim().toLocaleLowerCase() === value.supplierName.toLocaleLowerCase());
    const tinConflict = Boolean(value.tin && conflicts.some(item => String(item.tin_number || "").replace(/[\s-]/g, "") === value.tin));
    if (nameConflict || tinConflict) {
      return respond({
        code: "CONFLICT",
        message: "Another supplier already uses this name or TIN.",
        fieldErrors: {
          ...(nameConflict ? { supplierName: "Another supplier already uses this name." } : {}),
          ...(tinConflict ? { tin: "Another supplier already uses this TIN." } : {}),
        },
      }, 409);
    }

    const updated = await updatePayee(supplierId, { supplier_name: value.supplierName, tin_number: value.tin });
    return respond({ supplierId: updated.id, supplierName: updated.supplier_name, tin: updated.tin_number || "" }, 200);
  } catch {
    return respond({ code: "FOUNDATION_UNAVAILABLE", message: "The identity update could not be confirmed. Reload the payee before retrying." }, 503);
  }
}
