//src/modules/financial-management/chart-of-accounts/providers/fetchProvider.ts
import type {
  AccountTypeRow,
  BalanceTypeRow,
  BSISTypeRow,
  COACreatePayload,
  COAListParams,
  COARow,
  COAUpdatePayload,
  DirectusListResponse,
  DirectusSingleResponse,
} from "../types";

const API = "/api/fm/chart-of-accounts";

async function safeJson(res: Response) {
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  return res.text();
}

function errMsg(data: any) {
  if (!data) return "Request failed";
  if (typeof data === "string") return data;
  return data?.errors?.[0]?.message || data?.message || data?.error || "Request failed";
}

export async function listCOA(params: COAListParams): Promise<DirectusListResponse<COARow>> {
  const sp = new URLSearchParams();
  sp.set("resource", "chart_of_accounts");
  sp.set("q", params.q || "");
  sp.set("page", String(params.page));
  sp.set("pageSize", String(params.pageSize));

  const res = await fetch(`${API}?${sp.toString()}`, { cache: "no-store" });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(errMsg(data));
  return data as DirectusListResponse<COARow>;
}

export async function createCOA(payload: COACreatePayload): Promise<DirectusSingleResponse<COARow>> {
  const sp = new URLSearchParams();
  sp.set("resource", "chart_of_accounts");

  const res = await fetch(`${API}?${sp.toString()}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await safeJson(res);
  if (!res.ok) throw new Error(errMsg(data));
  return data as DirectusSingleResponse<COARow>;
}

export async function updateCOA(id: number, payload: COAUpdatePayload): Promise<DirectusSingleResponse<COARow>> {
  const res = await fetch(`${API}?resource=chart_of_accounts`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id, payload }),
  });

  const data = await safeJson(res);
  if (!res.ok) throw new Error(errMsg(data));
  return data as DirectusSingleResponse<COARow>;
}

export async function deleteCOA(id: number): Promise<void> {
  const sp = new URLSearchParams();
  sp.set("resource", "chart_of_accounts");
  sp.set("id", String(id));

  const res = await fetch(`${API}?${sp.toString()}`, { method: "DELETE" });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(errMsg(data));
}

/** Lookups */
export async function listAccountTypes(): Promise<AccountTypeRow[]> {
  const res = await fetch(`${API}?resource=account_types`, { cache: "no-store" });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(errMsg(data));
  return (data?.data ?? []) as AccountTypeRow[];
}

export async function listBalanceTypes(): Promise<BalanceTypeRow[]> {
  const res = await fetch(`${API}?resource=balance_type`, { cache: "no-store" });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(errMsg(data));
  return (data?.data ?? []) as BalanceTypeRow[];
}

export async function listBSISTypes(): Promise<BSISTypeRow[]> {
  const res = await fetch(`${API}?resource=bsis_types`, { cache: "no-store" });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(errMsg(data));
  return (data?.data ?? []) as BSISTypeRow[];
}
