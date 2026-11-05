import type { NextRequest } from "next/server";
import type { SupplierMemoType } from "@/modules/financial-management/accounting/supplier-memos/types";
import { MemoError, readRows, relationId } from "./directus";

export interface MemoActor { id: number; name: string }

export async function requireMemoAccess(request: NextRequest, type: SupplierMemoType): Promise<MemoActor> {
  const token = request.cookies.get("vos_access_token")?.value;
  if (!token) throw new MemoError("Please sign in to use supplier memos.", 401);
  const spring = (process.env.SPRING_API_BASE_URL || "").replace(/\/+$/, "");
  if (!spring) throw new MemoError("Authentication service is unavailable.", 503);
  let response: Response;
  try {
    response = await fetch(spring + "/auth/me", {
      headers: { Authorization: "Bearer " + token }, cache: "no-store", signal: AbortSignal.timeout(10_000),
    });
  } catch { throw new MemoError("Authentication service is unavailable. Please try again.", 503); }
  if (response.status === 401 || response.status === 403) throw new MemoError("Your session has expired. Please sign in again.", 401);
  if (!response.ok) throw new MemoError("Authentication service is unavailable.", 503);
  const user = await response.json();
  const id = relationId(user.id);
  if (!id || user.isDeleted) throw new MemoError("Your session is no longer valid.", 401);
  if (!user.admin) {
    const rows = await readRows<{ module_id?: { base_path?: string } }>("user_access_modules",
      { user_id: { _eq: id } }, "id,module_id.base_path");
    const path = "/fm/accounting/supplier-" + (type === 1 ? "credit" : "debit") + "-memo";
    const allowed = rows.some(row => {
      const base = String(row.module_id?.base_path || "").replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
      return base && (path === base || path.startsWith(base + "/"));
    });
    if (!allowed) throw new MemoError("You do not have access to this supplier memo module.", 403);
  }
  return { id, name: [user.firstName, user.middleName, user.lastName].filter(Boolean).join(" ") || "User #" + id };
}
